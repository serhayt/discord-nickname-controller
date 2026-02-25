const { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const messages = require('../messages.json');

module.exports = {
    name: 'ticketkur',
    async execute(message, args, client, config) {
        if (message.author.id !== message.guild.ownerId) return message.reply("🚫 Sadece Sunucu Sahibi!");
        if (config.setup_complete) return message.reply("⚠️ Sistem zaten kurulu!");

        const filter = m => m.author.id === message.author.id;
        await message.reply("📂 ADIM 1: Ticket Kategori ID:");
        const cat = await message.channel.awaitMessages({ filter, max: 1 });
        config.log_category_id = cat.first().content;

        await message.reply("📜 ADIM 2: Modmail Kanal ID:");
        const log = await message.channel.awaitMessages({ filter, max: 1 });
        config.modmail_channel_id = log.first().content;
        fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));

        const menu = new StringSelectMenuBuilder().setCustomId('setup_category_select').setPlaceholder('Birim Seç veya Bitir')
            .addOptions([...Object.keys(messages).map(k => ({ label: k.replace('ticket_', '').toUpperCase(), value: k })), { label: "✅ KURULUMU BİTİR VE RESTART", value: "finish_setup" }]);
        await message.reply({ content: '⚙️ Birimleri kur, bitince Restart seç:', components: [new ActionRowBuilder().addComponents(menu)] });
    },
    async handleInteraction(interaction, client, config) {
        if (interaction.values[0] === "finish_setup") {
            config.setup_complete = true;
            fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
            await interaction.update({ content: "🚀 Bitti! 5sn sonra restart...", components: [] });
            setTimeout(() => process.exit(0), 5000);
            return;
        }
        const type = interaction.values[0];
        await interaction.update({ content: `📍 ${type} için Kanal ID:`, components: [] });
        const filter = m => m.author.id === interaction.user.id;
        const idCol = interaction.channel.createMessageCollector({ filter, max: 1 });
        idCol.on('collect', async m => {
            const cId = m.content;
            await m.reply("👤 Yetkili etiketle:");
            const sCol = interaction.channel.createMessageCollector({ filter, max: 1 });
            sCol.on('collect', async sm => {
                const st = sm.mentions.users.first();
                config.channels[type] = { id: cId, staff: st.id, status: "open" };
                fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
                const target = client.channels.cache.get(cId);
                if (target) {
                    const d = messages[type];
                    const emb = new EmbedBuilder().setTitle(d.title).setDescription(d.description).setColor(d.color).setImage(d.image);
                    const btn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`open_ticket_${type}`).setLabel('Talep Oluştur').setStyle(ButtonStyle.Success));
                    target.send({ embeds: [emb], components: [btn] });
                }
                await sm.reply(`✅ ${type} Kuruldu!`);
            });
        });
    }
};
                  
