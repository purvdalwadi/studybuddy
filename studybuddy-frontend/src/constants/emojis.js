// List of supported reaction types that match the backend validation
// These are the only reaction types that will be displayed in the reaction picker
// and can be used to react to messages

export const SUPPORTED_REACTIONS = [
  'like',
  'love',
  'laugh',
  'wow',
  'sad',
  'angry',
  'thumbsup',
  'thumbsdown',
  'heart',
  'fire',
  'clap',
  'pray',
  'rocket',
  'eyes',
  'thinking',
  'tada',
  'check'
];

// Map of reaction types to emoji for display
export const REACTION_EMOJIS = {
  'like': '👍',
  'love': '❤️',
  'laugh': '😂',
  'wow': '😮',
  'sad': '😢',
  'angry': '😠',
  'thumbsup': '👍',
  'thumbsdown': '👎',
  'heart': '❤️',
  'fire': '🔥',
  'clap': '👏',
  'pray': '🙏',
  'rocket': '🚀',
  'eyes': '👀',
  'thinking': '🤔',
  'tada': '🎉',
  'check': '✅'
};

// Map of reaction types to description for accessibility
export const REACTION_DESCRIPTIONS = {
  'like': 'Like this message',
  'love': 'Love this message',
  'laugh': 'This is funny',
  'wow': 'This is surprising',
  'sad': 'This is sad',
  'angry': 'This makes me angry',
  'thumbsup': 'I agree with this',
  'thumbsdown': 'I disagree with this',
  'heart': 'I love this',
  'fire': 'This is lit!',
  'clap': 'Well said!',
  'pray': 'Prayers for this',
  'rocket': 'This is amazing!',
  'eyes': 'I see what you did there',
  'thinking': 'Hmm, interesting point',
  'tada': 'Congratulations!',
  'check': 'Got it, thanks!'
};

// Function to check if an emoji is supported
export const isEmojiSupported = (emoji) => {
  return SUPPORTED_EMOJIS.includes(emoji);
};
