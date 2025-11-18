import validator from 'validator';

// Хранилище для rate limiting (в продакшене используйте Redis)
const rateLimitStore = new Map();

export function validateFormData(formData) {
  const errors = [];

  // 1. Валидация Discord ID
  if (!formData.discordId || !/^\d{17,20}$/.test(formData.discordId)) {
    errors.push({
      field: 'discordId',
      message: 'Discord ID должен содержать 17-20 цифр'
    });
  }

  // 2. Валидация имени и статика
  if (!formData.nameStatic || !/^[A-Za-zА-Яа-яёЁ\s]+\s\|\s\d+$/.test(formData.nameStatic)) {
    errors.push({
      field: 'nameStatic', 
      message: 'Формат: Имя Фамилия | Число (например: Rick Valenkov | 289877)'
    });
  }

  // 3. Валидация ранга
  if (!formData.rank || !validator.isNumeric(formData.rank)) {
    errors.push({
      field: 'rank',
      message: 'Ранг должен быть числом'
    });
  } else {
    const rankNum = parseInt(formData.rank);
    if (rankNum < 1 || rankNum > 100) {
      errors.push({
        field: 'rank',
        message: 'Ранг должен быть от 1 до 100'
      });
    }
  }

  // 4. Валидация отдела
  const validDepartments = ['DEA', 'CID', 'IB', 'AF', 'NSB', 'HRT', 'FA', 'GS', 'HRB'];
  if (!formData.department || !validDepartments.includes(formData.department)) {
    errors.push({
      field: 'department',
      message: 'Выберите отдел из списка'
    });
  }

  // 5. Валидация URL скриншотов
  if (!formData.tabletScreenshot || !isValidURL(formData.tabletScreenshot)) {
    errors.push({
      field: 'tabletScreenshot',
      message: 'Введите корректный URL скриншота планшета'
    });
  }

  if (!formData.inventoryScreenshot || !isValidURL(formData.inventoryScreenshot)) {
    errors.push({
      field: 'inventoryScreenshot', 
      message: 'Введите корректный URL скриншота инвентаря'
    });
  }

  // 6. Валидация причины
  if (!formData.reason || formData.reason.length < 5) {
    errors.push({
      field: 'reason',
      message: 'Причина увольнения должна содержать минимум 5 символов'
    });
  }

  // 7. Проверка honeypot поля (защита от ботов)
  if (formData.website && formData.website.length > 0) {
    errors.push({
      field: 'general',
      message: 'Обнаружена подозрительная активность'
    });
  }

  return {
    isValid: errors.length === 0,
    errors: errors
  };
}

function isValidURL(url) {
  return validator.isURL(url, {
    protocols: ['http', 'https'],
    require_protocol: true,
    require_valid_protocol: true,
    disallow_auth: true
  });
}

export function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  
  return validator.escape(
    validator.trim(input)
  ).substring(0, 1000);
}

export async function checkRateLimit(ip) {
  const now = Date.now();
  const windowMs = 2 * 60 * 1000; // 2 минуты
  const maxRequests = 3;

  // Очистка старых записей
  cleanupRateLimitStore();

  if (!rateLimitStore.has(ip)) {
    rateLimitStore.set(ip, []);
  }

  const requests = rateLimitStore.get(ip);
  const validRequests = requests.filter(time => now - time < windowMs);
  
  if (validRequests.length >= maxRequests) {
    return true; // Превышен лимит
  }

  validRequests.push(now);
  rateLimitStore.set(ip, validRequests);
  
  return false;
}

function cleanupRateLimitStore() {
  const now = Date.now();
  const windowMs = 2 * 60 * 1000;
  
  for (const [ip, requests] of rateLimitStore.entries()) {
    const validRequests = requests.filter(time => now - time < windowMs);
    if (validRequests.length === 0) {
      rateLimitStore.delete(ip);
    } else {
      rateLimitStore.set(ip, validRequests);
    }
  }
}

export function detectSuspiciousActivity(formData, userAgent) {
  const suspiciousPatterns = [
    // Слишком короткое время заполнения
    formData.fillTime && formData.fillTime < 10000,
    
    // Подозрительный User-Agent
    !userAgent || 
    userAgent.includes('bot') || 
    userAgent.includes('crawler') ||
    userAgent.length < 20,
    
    // Слишком длинные или короткие значения
    formData.reason && formData.reason.length > 1000,
    formData.nameStatic && formData.nameStatic.length > 100,
    
    // Попытка SQL-инъекции (базовые паттерны)
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|EXEC)\b)/i.test(formData.reason) ||
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|EXEC)\b)/i.test(formData.nameStatic)
  ];

  return suspiciousPatterns.some(pattern => pattern === true);
}