import { validateFormData, sanitizeInput, checkRateLimit, detectSuspiciousActivity } from './validation-utils.js';
import { sendDiscordNotification } from './discord-webhook.js';

export const handler = async (event) => {
  // Логирование для отладки
  console.log('Received form submission:', {
    method: event.httpMethod,
    path: event.path,
    headers: event.headers
  });

  // Настройка CORS
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Обработка preflight OPTIONS запроса
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Проверка метода
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ 
        success: false, 
        message: 'Method Not Allowed' 
      })
    };
  }

  try {
    // Парсинг тела запроса
    let formData;
    try {
      formData = JSON.parse(event.body);
    } catch (parseError) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          message: 'Неверный формат данных' 
        })
      };
    }

    console.log('Form data received:', {
      discordId: formData.discordId ? '***' + formData.discordId.slice(-4) : 'missing',
      nameStatic: formData.nameStatic ? 'present' : 'missing',
      department: formData.department || 'missing'
    });

    // Получение IP клиента
    const clientIP = event.headers['client-ip'] || 
                    event.headers['x-forwarded-for']?.split(',')[0] || 
                    event.headers['x-nf-client-connection-ip'] || 
                    'unknown';

    // Проверка rate limiting
    if (await checkRateLimit(clientIP)) {
      return {
        statusCode: 429,
        headers,
        body: JSON.stringify({ 
          success: false, 
          message: 'Слишком много запросов. Пожалуйста, подождите 2 минуты.' 
        })
      };
    }

    // Проверка на подозрительную активность
    if (detectSuspiciousActivity(formData, event.headers['user-agent'])) {
      return {
        statusCode: 422,
        headers,
        body: JSON.stringify({ 
          success: false, 
          message: 'Обнаружена подозрительная активность' 
        })
      };
    }

    // Серверная валидация
    const validationResult = validateFormData(formData);
    if (!validationResult.isValid) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          message: 'Ошибки валидации формы',
          errors: validationResult.errors 
        })
      };
    }

    // Санитизация данных
    const sanitizedData = {
      discordId: sanitizeInput(formData.discordId),
      nameStatic: sanitizeInput(formData.nameStatic),
      rank: sanitizeInput(formData.rank),
      department: sanitizeInput(formData.department),
      tabletScreenshot: sanitizeInput(formData.tabletScreenshot),
      inventoryScreenshot: sanitizeInput(formData.inventoryScreenshot),
      reason: sanitizeInput(formData.reason),
      userIP: clientIP,
      userAgent: event.headers['user-agent'] || 'unknown',
      timestamp: new Date().toISOString(),
      fillTime: formData.fillTime || 0
    };

    console.log('Sanitized data ready for processing');

    // Отправка уведомления в Discord
    try {
      await sendDiscordNotification(sanitizedData);
      console.log('Discord notification sent successfully');
    } catch (discordError) {
      console.error('Failed to send Discord notification:', discordError);
      // Продолжаем выполнение, даже если Discord недоступен
    }

    // Успешный ответ
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        message: 'Рапорт успешно отправлен! Ожидайте ответа в Discord.' 
      })
    };

  } catch (error) {
    console.error('Unhandled error in submit-resignation:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        message: 'Внутренняя ошибка сервера. Пожалуйста, попробуйте позже.' 
      })
    };
  }
};
