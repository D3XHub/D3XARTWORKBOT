const {
    Client,
    GatewayIntentBits,
    Partials,
    SlashCommandBuilder,
    Routes,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    REST
} = require("discord.js");

require("dotenv").config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
});

// -----------------------------
// ดึงตัวแปรจาก .env
// -----------------------------
const ALLOW_ROLE_ID = process.env.ALLOW_ROLE_ID;
const MOVE_CHANNEL_ID = process.env.MOVE_CHANNEL_ID;


// -----------------------------
// ลงทะเบียนคำสั่ง /คิวงาน
// -----------------------------
const commands = [
    new SlashCommandBuilder()
        .setName("คิวงาน")
        .setDescription("สร้างรายการคิวงานใหม่")
        .addStringOption(o =>
            o.setName("งาน")
                .setDescription("ชื่องาน")
                .setRequired(true)
        )
        .addStringOption(o =>
            o.setName("สถานะ")
                .setDescription("สถานะงาน")
                .addChoices(
                    { name: "รอดำเนินการ", value: "pending" },
                    { name: "งานเสร็จสิ้น", value: "done" }
                )
                .setRequired(true)
        )
        .addUserOption(o =>
            o.setName("ลูกค้า")
                .setDescription("แท็กลูกค้า")
                .setRequired(true)
        )
        .addChannelOption(o =>
            o.setName("ห้องงาน")
                .setDescription("#ห้องงาน")
                .setRequired(true)
        )
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
    try {
        console.log("กำลังอัปโหลดคำสั่ง...");

        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands }
        );

        console.log("อัปโหลดคำสั่งเสร็จสิ้น!");
    } catch (err) {
        console.log(err);
    }
})();


// -----------------------------
// Bot Ready
// -----------------------------
client.on("ready", () => {
    console.log(`Bot Online เป็น ${client.user.tag}`);
});


// -----------------------------
// ดัก Interaction
// -----------------------------
client.on("interactionCreate", async interaction => {

    // -----------------------------
    // /คิวงาน
    // -----------------------------
    if (interaction.isChatInputCommand() && interaction.commandName === "คิวงาน") {

        if (!interaction.member.permissions.has("Administrator"))
            return interaction.reply({
                content: "❌ คุณไม่มีสิทธิ์ใช้คำสั่งนี้",
                ephemeral: true
            });

        const job = interaction.options.getString("งาน");
        const status = interaction.options.getString("สถานะ");
        const customer = interaction.options.getUser("ลูกค้า");
        const workRoom = interaction.options.getChannel("ห้องงาน");

        const TARGET_CHANNEL_ID = "1442891619496886382"; // ห้องที่โพสต์คิวงาน

        const statusText =
            status === "pending"
                ? "⚙️ รอดำเนินการ"
                : "✅ งานเสร็จสิ้น";

        const color =
            status === "pending" ? 0xff0000 : 0x00FF00;

        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle(`📋 คิวงานใหม่: ${job}`)
            .addFields(
                { name: "สถานะ:", value: statusText, inline: true },
                { name: "ลูกค้า:", value: `${customer}`, inline: true },
                { name: "ห้องสั่งงาน:", value: `${workRoom}`, inline: true },
                { name: "รายการสินค้า", value: job },
                { name: "ID ลูกค้า", value: customer.id }
            )
            .setThumbnail(customer.displayAvatarURL({ size: 512 }))
            .setFooter({ text: "ระบบคิวงาน - D3X ARTWORK" })
            .setTimestamp();

        // ปุ่มเหลือแค่ งานเสร็จสิ้น
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("status_done")
                .setLabel("งานเสร็จสิ้น")
                .setStyle(ButtonStyle.Success)
        );

        const msg = await client.channels.cache
            .get(TARGET_CHANNEL_ID)
            .send({ embeds: [embed], components: [row] });

        return interaction.reply({
            content: `สร้างคิวงานสำเร็จ! (Message ID: ${msg.id})`,
            ephemeral: true
        });
    }


    // -----------------------------
    // ปุ่ม: งานเสร็จสิ้น → ย้ายห้อง + ลบข้อความเก่า
    // -----------------------------
    if (interaction.isButton() && interaction.customId === "status_done") {

        if (!interaction.member.roles.cache.has(ALLOW_ROLE_ID))
            return interaction.reply({
                content: "❌ คุณไม่มีสิทธิ์กดปุ่มนี้",
                ephemeral: true
            });

        const old = interaction.message.embeds[0];
        if (!old)
            return interaction.reply({
                content: "ไม่พบ embed",
                ephemeral: true
            });

        // อัปเดตสถานะ
        const edited = EmbedBuilder.from(old)
            .setColor(0x00FF00)
            .spliceFields(0, 1, {
                name: "สถานะ:",
                value: "✅ งานเสร็จสิ้น",
                inline: true
            });

        // ส่งไปห้องปลายทางที่กำหนดใน .env
        const targetChannel = client.channels.cache.get(MOVE_CHANNEL_ID);
        if (targetChannel) {
            await targetChannel.send({ embeds: [edited] });
        }

        // ลบข้อความเก่า
        await interaction.message.delete().catch(() => {});

        return interaction.reply({
            content: "📌 งานเสร็จสิ้น! ข้อความถูกย้ายและลบเรียบร้อยแล้ว",
            ephemeral: true
        });
    }

});

client.login(process.env.TOKEN);
