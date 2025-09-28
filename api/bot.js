// api/bot.js - Fonction serverless Vercel
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

// 🔧 Configuration
const CONFIG = {
  DISCORD_TOKEN: process.env.DISCORD_TOKEN,
  GUILD_ID: '1421669500109066375',
  VIP_MONTHLY_ROLE_ID: '1421670147709468762',
  VIP_LIFETIME_ROLE_ID: '1421735904401297489',
  VIP_LOGS_CHANNEL_ID: '1421697626830798938',
  BOT_COMMANDS_CHANNEL_ID: '1421697987066859673',
  WEBHOOK_SECRET: process.env.WEBHOOK_SECRET
};

// Instance client Discord globale
let client = null;

// 🤖 Initialiser le client Discord
async function initDiscordClient() {
  if (client && client.isReady()) {
    return client;
  }
  
  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers
    ]
  });
  
  await client.login(CONFIG.DISCORD_TOKEN);
  
  return new Promise((resolve) => {
    client.once('ready', () => {
      console.log(`✅ Bot connecté: ${client.user.tag}`);
      resolve(client);
    });
  });
}

// 🎯 Donner le rôle VIP
async function giveVipRole(discordId, roleType) {
  try {
    await initDiscordClient();
    
    const guild = client.guilds.cache.get(CONFIG.GUILD_ID);
    if (!guild) throw new Error('Serveur Discord introuvable');
    
    const member = await guild.members.fetch(discordId).catch(() => null);
    if (!member) {
      return { success: false, error: 'Membre introuvable sur le serveur' };
    }
    
    let roleId;
    if (roleType.includes('Mensuel')) {
      roleId = CONFIG.VIP_MONTHLY_ROLE_ID;
    } else if (roleType.includes('Vie')) {
      roleId = CONFIG.VIP_LIFETIME_ROLE_ID;
    } else {
      throw new Error(`Type de rôle inconnu: ${roleType}`);
    }
    
    const role = guild.roles.cache.get(roleId);
    if (!role) throw new Error(`Rôle introuvable sur le serveur`);
    
    if (member.roles.cache.has(roleId)) {
      return { success: true, message: 'Rôle déjà attribué', member: member.user.tag };
    }
    
    await member.roles.add(role);
    console.log(`✅ Rôle ${role.name} donné à ${member.user.tag}`);
    
    // Log dans Discord
    await logVipAction(member, role, 'attribution');
    
    return { 
      success: true, 
      member: member.user.tag, 
      role: role.name,
      action: 'attribution'
    };
    
  } catch (error) {
    console.error('❌ Erreur attribution rôle:', error.message);
    return { success: false, error: error.message };
  }
}

// 🚫 Retirer le rôle VIP
async function removeVipRole(discordId, roleType) {
  try {
    await initDiscordClient();
    
    const guild = client.guilds.cache.get(CONFIG.GUILD_ID);
    if (!guild) throw new Error('Serveur Discord introuvable');
    
    const member = await guild.members.fetch(discordId).catch(() => null);
    if (!member) {
      return { success: false, error: 'Membre introuvable' };
    }
    
    let roleId;
    if (roleType.includes('Mensuel')) {
      roleId = CONFIG.VIP_MONTHLY_ROLE_ID;
    } else if (roleType.includes('Vie')) {
      roleId = CONFIG.VIP_LIFETIME_ROLE_ID;
    } else {
      throw new Error(`Type de rôle inconnu: ${roleType}`);
    }
    
    const role = guild.roles.cache.get(roleId);
    if (!role) throw new Error(`Rôle introuvable`);
    
    if (!member.roles.cache.has(roleId)) {
      return { success: true, message: 'Rôle déjà absent' };
    }
    
    await member.roles.remove(role);
    console.log(`🚫 Rôle ${role.name} retiré à ${member.user.tag}`);
    
    await logVipAction(member, role, 'suppression');
    
    return { 
      success: true, 
      member: member.user.tag, 
      role: role.name,
      action: 'suppression'
    };
    
  } catch (error) {
    console.error('❌ Erreur suppression rôle:', error.message);
    return { success: false, error: error.message };
  }
}

// 📝 Logger les actions VIP
async function logVipAction(member, role, action) {
  try {
    const channel = client.channels.cache.get(CONFIG.VIP_LOGS_CHANNEL_ID);
    if (!channel) return;
    
    const isAttribution = action === 'attribution';
    const color = isAttribution ? 0x00ff00 : 0xff9900;
    const emoji = isAttribution ? '🎉' : '⏰';
    const title = isAttribution ? 'Nouveau membre VIP!' : 'Rôle VIP retiré';
    
    const embed = new EmbedBuilder()
      .setTitle(`${emoji} ${title}`)
      .setDescription(`${member} - Rôle **${role.name}** ${isAttribution ? 'attribué' : 'retiré'}`)
      .addFields(
        { name: '👤 Utilisateur', value: `${member.user.tag}\n\`${member.id}\``, inline: true },
        { name: '🏷️ Rôle', value: role.name, inline: true },
        { name: '⚡ Action', value: action, inline: true }
      )
      .setColor(color)
      .setThumbnail(member.user.displayAvatarURL())
      .setTimestamp()
      .setFooter({ text: 'Bot VIP Brawl Stars' });
    
    await channel.send({ embeds: [embed] });
    
  } catch (error) {
    console.error('❌ Erreur log VIP:', error.message);
  }
}

// 🌐 Handler principal pour Vercel
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  try {
    if (req.method === 'GET') {
      // Status endpoint
      if (req.url === '/api/bot' || req.url === '/api/bot/status') {
        await initDiscordClient();
        const guild = client.guilds.cache.get(CONFIG.GUILD_ID);
        
        return res.json({
          status: 'ok',
          botReady: client.isReady(),
          botTag: client.isReady() ? client.user.tag : 'Non connecté',
          guildName: guild ? guild.name : 'Serveur introuvable',
          memberCount: guild ? guild.memberCount : 0,
          timestamp: new Date().toISOString()
        });
      }
      
      // Test endpoint
      if (req.url === '/api/bot/test') {
        await initDiscordClient();
        const guild = client.guilds.cache.get(CONFIG.GUILD_ID);
        
        const testInfo = {
          botConnected: client.isReady(),
          guild: guild ? guild.name : 'Non trouvé',
          roles: {
            monthly: guild?.roles.cache.get(CONFIG.VIP_MONTHLY_ROLE_ID)?.name || 'Non trouvé',
            lifetime: guild?.roles.cache.get(CONFIG.VIP_LIFETIME_ROLE_ID)?.name || 'Non trouvé'
          },
          channels: {
            logs: client.channels.cache.get(CONFIG.VIP_LOGS_CHANNEL_ID)?.name || 'Non trouvé',
            commands: client.channels.cache.get(CONFIG.BOT_COMMANDS_CHANNEL_ID)?.name || 'Non trouvé'
          }
        };
        
        return res.json({ test: 'ok', info: testInfo });
      }
    }
    
    if (req.method === 'POST') {
      const { action, discordId, roleType, secret, paymentInfo } = req.body;
      
      console.log(`📨 Requête reçue: ${action || 'give'} pour ${discordId} (${roleType})`);
      
      // Vérification de sécurité
      if (secret !== CONFIG.WEBHOOK_SECRET) {
        console.warn('❌ Tentative d\'accès non autorisée');
        return res.status(401).json({ error: 'Non autorisé' });
      }
      
      if (!discordId || !roleType) {
        return res.status(400).json({ error: 'discordId et roleType requis' });
      }
      
      let result;
      
      if (action === 'give' || !action) {
        result = await giveVipRole(discordId, roleType);
      } else if (action === 'remove') {
        result = await removeVipRole(discordId, roleType);
      } else {
        return res.status(400).json({ error: 'Action inconnue' });
      }
      
      console.log(`📊 Résultat ${action || 'give'}:`, result);
      return res.json(result);
    }
    
    res.status(405).json({ error: 'Méthode non autorisée' });
    
  } catch (error) {
    console.error('❌ Erreur handler:', error.message);
    res.status(500).json({ error: error.message });
  }
}
