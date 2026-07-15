/**
 * Music utilities — thin wrapper around @discordjs/voice + yt-dlp-exec.
 *
 * Queue shape per guild:
 *  {
 *    voiceChannel, textChannel, connection, player,
 *    tracks: [{ title, url, requestedBy }],
 *    playing: boolean,
 *    volume: number (0–1),
 *  }
 */
const {
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  StreamType,
} = require('@discordjs/voice');
const ytdlp   = require('yt-dlp-exec');
const { PassThrough } = require('stream');
const { logger } = require('./logger');

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getTrackInfo(query) {
  const isUrl = /^https?:\/\//.test(query);
  const searchQuery = isUrl ? query : `ytsearch1:${query}`;

  const info = await ytdlp(searchQuery, {
    dumpSingleJson: true,
    noWarnings: true,
    noCallHome: true,
    noCheckCertificate: true,
    preferFreeFormats: true,
    youtubeSkipDashManifest: true,
  });

  const entry = info.entries ? info.entries[0] : info;
  return {
    title:  entry.title  ?? 'Unknown',
    url:    entry.webpage_url ?? entry.url ?? query,
    duration: entry.duration ?? 0,
  };
}

function createStream(url) {
  const pass = new PassThrough();
  ytdlp.exec(url, {
    output: '-',
    format: 'bestaudio[ext=webm]/bestaudio/best',
    noWarnings: true,
    quiet: true,
  }, { stdio: ['ignore', 'pipe', 'ignore'] })
    .then(proc => proc.stdout.pipe(pass))
    .catch(err => {
      logger.error('yt-dlp stream error:', err.message);
      pass.destroy(err);
    });
  return pass;
}

// ── Queue management ─────────────────────────────────────────────────────────

function playNext(guildId, musicQueue) {
  const queue = musicQueue.get(guildId);
  if (!queue) return;

  if (queue.tracks.length === 0) {
    queue.playing = false;
    // Disconnect after 2 minutes of silence
    setTimeout(() => {
      const q = musicQueue.get(guildId);
      if (q && !q.playing) {
        q.connection?.destroy();
        musicQueue.delete(guildId);
      }
    }, 120_000);
    return;
  }

  const track = queue.tracks.shift();
  queue.playing = true;

  const stream   = createStream(track.url);
  const resource = createAudioResource(stream, {
    inputType: StreamType.Arbitrary,
    inlineVolume: true,
  });
  resource.volume?.setVolume(queue.volume ?? 0.5);

  queue.player.play(resource);
  queue.currentTrack = track;

  queue.textChannel?.send({
    embeds: [{
      color: 0x5865F2,
      title: '🎵 Now Playing',
      description: `**[${track.title}](${track.url})**`,
      footer: { text: `Requested by ${track.requestedBy}` },
    }],
  }).catch(() => {});
}

async function joinAndPlay(interaction, query, musicQueue) {
  const voiceChannel = interaction.member?.voice?.channel;
  if (!voiceChannel) {
    return interaction.reply({ content: '❌ You must be in a voice channel.', ephemeral: true });
  }

  await interaction.deferReply();

  let trackInfo;
  try {
    trackInfo = await getTrackInfo(query);
  } catch (err) {
    logger.error('getTrackInfo failed:', err.message);
    return interaction.editReply('❌ Could not find that track. Try a different query.');
  }

  trackInfo.requestedBy = interaction.user.tag;

  let queue = musicQueue.get(interaction.guildId);

  if (!queue) {
    const connection = joinVoiceChannel({
      channelId:      voiceChannel.id,
      guildId:        interaction.guildId,
      adapterCreator: interaction.guild.voiceAdapterCreator,
    });

    const player = createAudioPlayer();
    connection.subscribe(player);

    player.on(AudioPlayerStatus.Idle, () => playNext(interaction.guildId, musicQueue));
    player.on('error', err => logger.error('AudioPlayer error:', err.message));

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting,  5_000),
        ]);
      } catch {
        connection.destroy();
        musicQueue.delete(interaction.guildId);
      }
    });

    queue = {
      voiceChannel,
      textChannel: interaction.channel,
      connection,
      player,
      tracks: [],
      playing: false,
      volume: 0.5,
      currentTrack: null,
    };
    musicQueue.set(interaction.guildId, queue);
  }

  queue.tracks.push(trackInfo);

  if (!queue.playing) {
    playNext(interaction.guildId, musicQueue);
    await interaction.editReply({
      embeds: [{
        color: 0x5865F2,
        title: '🎵 Now Playing',
        description: `**[${trackInfo.title}](${trackInfo.url})**`,
      }],
    });
  } else {
    await interaction.editReply({
      embeds: [{
        color: 0x57F287,
        title: '➕ Added to Queue',
        description: `**[${trackInfo.title}](${trackInfo.url})**`,
        footer: { text: `Position: #${queue.tracks.length}` },
      }],
    });
  }
}

module.exports = { joinAndPlay, playNext };
