import axios from 'axios';

export async function sendDiscordNotification(formData) {
  const webhookURL = process.env.DISCORD_WEBHOOK_URL;

  if (!webhookURL) {
    console.warn('DISCORD_WEBHOOK_URL not configured');
    return;
  }

  // Создаем красивый embed для Discord
  const embed = {
    title: "📄 НОВЫЙ РАПОРТ НА УВОЛЬНЕНИЕ",
    color: 15158332, // Красный цвет
    timestamp: formData.timestamp,
    footer: {
      text: "Federal Investigation Bureau • Система увольнений",
      icon_url: "https://i.imgur.com/7VEXVT1.png"
    },
    thumbnail: {
      url: "https://i.imgur.com/7VEXVT1.png"
    },
    fields: [
      {
        name: "👤 СОТРУДНИК",
        value: `\`\`\`${formData.nameStatic}\`\`\``,
        inline: true
      },
      {
        name: "🎯 ОТДЕЛ",
        value: `\`\`\`${formData.department}\`\`\``,
        inline: true
      },
      {
        name: "⭐ РАНГ",
        value: `\`\`\`${formData.rank}\`\`\``,
        inline: true
      },
      {
        name: "🆔 DISCORD ID",
        value: `\`\`\`${formData.discordId}\`\`\``,
        inline: false
      },
      {
        name: "📝 ПРИЧИНА УВОЛЬНЕНИЯ",
        value: `\`\`\`${formData.reason}\`\`\``,
        inline: false
      },
      {
        name: "🔗 ССЫЛКИ НА СКРИНШОТЫ",
        value: `**Планшет:** ${formData.tabletScreenshot}\n**Инвентарь:** ${formData.inventoryScreenshot}`,
        inline: false
      },
      {
        name: "🌐 ТЕХНИЧЕСКАЯ ИНФОРМАЦИЯ",
        value: `**IP:** ||${formData.userIP}||\n**Время заполнения:** ${formData.fillTime}ms\n**User Agent:** ${formData.userAgent.substring(0, 50)}...`,
        inline: false
      }
    ]
  };

  try {
    const response = await axios.post(webhookURL, {
      embeds: [embed],
      username: 'FIB Resignation System',
      avatar_url: 'https://i.imgur.com/7VEXVT1.png',
      content: `@here Новый рапорт на увольнение от **${formData.nameStatic}**!`
    }, {
      timeout: 10000 // 10 секунд таймаут
    });

    console.log('Discord webhook response:', response.status);
    return true;
  } catch (error) {
    console.error('Discord webhook error:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    throw new Error('Не удалось отправить уведомление в Discord');
  }
}