const { Client, GatewayIntentBits, Collection, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const Groq = require('groq-sdk');
const config = require('./config.json');
const messages = require('./messages.json');

const client = new Client({ intents: [3276799] });
const groq = new Groq({ apiKey: config.groq_api_key });
client.commands = new Collection();
const messageHistory = new Map();

const commandFiles = fs.readdirSync('./commands').filter(f => f.endsWith('.js'));
for (const file of commandFiles) {
    const cmd = require(`./commands/${file}`);
    client.commands.set(cmd.name, cmd);
}

const AI_SYSTEM_PROMPT = "Sen DcHizmetin sunucusunun resmi Yapay Zeka Danışmanısın. Profesyonel, ciddi ve çözüm odaklısın. Önceki mesajları hatırlarsın.";

async function handleTranscriptAndLog(channel, config, closedBy) {
    const logChannel = channel.guild.channels.cache.get(config.modmail_channel_id);
    if (!logChannel) return;
    const fetchedMessages = await channel.messages.fetch({ limit: 100 });
    const logs = fetchedMessages.reverse().map(m => `[${m.createdAt.toLocaleString()}] ${m.author.tag}: ${m.content}`).join('\n');
    const attachment = new AttachmentBuilder(Buffer.from(logs, 'utf-8'), { name: `log-${channel.name}.txt` });
    const embed = new EmbedBuilder().setTitle('📂 Ticket Arşivlendi').addFields({ name: 'Kapatan', value: closedBy.tag, inline: true }).setColor('Blurple').setTimestamp();
    await logChannel.send({ embeds: [embed], files: [attachment] });
}

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    const isMentioned = message.mentions.has(client.user) && !message.mentions.everyone;
    const isAiChannel = message.channel.id === config.ai_channel;

    if (isAiChannel || isMentioned) {
        try {
            message.channel.sendTyping();
            if (!messageHistory.has(message.channel.id)) messageHistory.set(message.channel.id, []);
            let history = messageHistory.get(message.channel.id);
            const userText = message.content.replace(/<@!?\d+>/g, '').trim();
            if (!userText && isMentioned) return message.reply("Sistemlerim aktif, buyurun.");
            history.push({ role: "user", content: userText });
            if (history.length > 12) history.shift();
            const completion = await groq.chat.completions.create({ messages: [{ role: "system", content: AI_SYSTEM_PROMPT }, ...history], model: "llama3-8b-8192" });
            const response = completion.choices[0].message.content;
            history.push({ role: "assistant", content: response });
            return message.reply(response);
        } catch (e) { console.error(e); }
    }

    if (!message.content.startsWith(config.prefix)) return;
    const args = message.content.slice(config.prefix.length).trim().split(/ +/);
    const cmdName = args.shift().toLowerCase();
    let command = client.commands.get(cmdName) || client.commands.find(c => cmdName.startsWith(c.name));
    if (command) command.execute(message, args, client, config);
});

client.on('interactionCreate', async (interaction) => {
    if (interaction.isStringSelectMenu() && interaction.customId === 'setup_category_select') {
        const ticketkur = client.commands.get('ticketkur');
        if (ticketkur) return ticketkur.handleInteraction(interaction, client, config);
    }
    if (!interaction.isButton()) return;
    const { customId, channel, user, guild } = interaction;
    const type = customId.split('_').pop();
    const data = config.channels[type] || config.channels[`ticket_${type}`];

    if (customId.startsWith('open_ticket_')) {
        if (data.status === "closed") return interaction.reply({ content: '⚠️ Stok yok kanka!', ephemeral: true });
        const ticketChannel = await guild.channels.create({
            name: `ticket-${user.username}`,
            parent: config.log_category_id,
            permissionOverwrites: [
                { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                { id: data.staff, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
            ]
        });
        const msgData = messages[type] || messages[`ticket_${type}`];
        const embed = new EmbedBuilder().setTitle(msgData.title).setDescription(`Selam <@${user.id}>, yetkilimiz <@${data.staff}> seninle ilgilenecek.`).setImage(msgData.image).setColor(msgData.color);
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`close_ticket_${type}`).setLabel('Kapat').setStyle(ButtonStyle.Danger));
        await ticketChannel.send({ content: `<@${user.id}> | <@${data.staff}>`, embeds: [embed], components: [row] });
        await interaction.reply({ content: `✅ Kanal açıldı: <#${ticketChannel.id}>`, ephemeral: true });
    }

    if (customId.startsWith('close_ticket_')) {
        if (user.id === data.staff || user.id === guild.ownerId) {
            await interaction.reply("🚫 Kapatılıyor (5sn)...");
            setTimeout(async () => { await handleTranscriptAndLog(channel, config, user); await channel.delete(); }, 5000);
        } else {
            await channel.permissionOverwrites.edit(user.id, { ViewChannel: false });
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`approve_close_${type}`).setLabel('Onayla').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId(`cancel_close_${type}`).setLabel('İptal').setStyle(ButtonStyle.Secondary));
            await channel.send({ content: `⚠️ <@${data.staff}>, kullanıcı kapattı. Onaylıyor musun?`, components: [row] });
        }
    }

    if (customId.startsWith('approve_close_')) {
        if (user.id !== data.staff && user.id !== guild.ownerId) return;
        await handleTranscriptAndLog(channel, config, user);
        await channel.delete();
    }

    if (customId.startsWith('cancel_close_')) {
        if (user.id !== data.staff && user.id !== guild.ownerId) return;
        const mName = channel.name.replace('ticket-', '');
        const member = guild.members.cache.find(m => m.user.username.toLowerCase() === mName.toLowerCase());
        if (member) await channel.permissionOverwrites.edit(member.id, { ViewChannel: true });
        await interaction.update({ content: "🔄 İptal edildi.", components: [] });
    }
});

client.login(config.token);
      
