const fs = require('fs');

module.exports = {
    name: 'stokkapat',
    async execute(message, args, client, config) {
        const cmd = message.content.slice(config.prefix.length).split(' ')[0].toLowerCase();
        const suffix = cmd.replace('stokkapat', '');
        const key = `ticket_${suffix}`;
        const data = config.channels[key];

        if (!data) return;

        if (message.author.id !== data.staff && message.author.id !== message.guild.ownerId) {
            return message.reply("❌ Bu birimin stoğunu sadece yetkilisi yönetebilir!");
        }

        config.channels[key].status = "closed";
        fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
        
        message.reply(`⚠️ **${suffix.toUpperCase()}** birimi işlemlere kapatıldı. Yeni talepler alınmayacak.`);
    }
};
