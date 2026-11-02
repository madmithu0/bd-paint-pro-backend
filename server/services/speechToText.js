const parseVoiceText = (transcript) => {
  const text = transcript.toLowerCase();
  const locationMatch = text.match(/(?:in|at|dhaka|dhanmondi|gulshan|mirpur|uttara|netrakona)[\w\s]*/);
  const mistriMatch = text.match(/(\d+)\s*(?:mistri|mistry|person|jon)/);
  const dateMatch = text.includes("tomorrow") || text.includes("kal") ? "tomorrow" : "today";
  return {
    location: locationMatch ? locationMatch[0].trim() : null,
    mistriCount: mistriMatch ? parseInt(mistriMatch[1]) : 1,
    date: dateMatch,
    rawText: transcript
  };
};
module.exports = { parseVoiceText };