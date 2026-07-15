/**
 * Music utilities — @discordjs/voice + play-dl (pure JS, no Python needed).
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
const playdl   = require('play-dl');
const { logger } = require('./logger');

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getTrackInfo(query) {
  const isUrl = /^https?:\/\//.test(query);

  if (isUrl) {
    const info = await playdl.video_info(query);
    return {
      title:    info.video_details.title  ?? 'Unknown',
      url:      info.video_details.url,
      duration: info.video_details.durationInSec ?? 0,
    };
  } else {
    const results = await playdl.search(query, { source: { youtube: 'video' }, limit: 1 });
    if (!results.length) throw new Error('No results found.');
    const v = results[0];
    return { title: v.title ?? 'Unknown', url: v.url, duration: v.durationInSec ?? 0 };
  }
}

async function createStream(url) {
  const stream = await playdl.stream(url, { quality: 2 });
  return stream;
}

// ── Queue management ─────────────────────────────────────────────────────────

async function playNext(guildId, musicQueue) {
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
  queue.currentTrack = track;

  try {
    const stream   = await createStream(track.url);
    const resource = createAudioResource(stream.stream, {
      inputType: stream.type,
      inlineVolume: true,
    });
    resource.volume?.setVolume(queue.volume ?? 0.5);
    queue.player.play(resource);
  } catch (err) {
    logger.error('Stream error:', err.message);
    queue.playing = false;
    // Try next track
    return playNext(guildId, musicQueue);
  }

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
    await playNext(interaction.guildId, musicQueue);
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
