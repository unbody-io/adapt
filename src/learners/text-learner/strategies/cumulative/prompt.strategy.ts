/**
 * Strategy prompt for cumulative understanding
 */
export const cumulativeStrategyPrompt = `You maintain understanding within a size limit. When understanding gets large,
you'll be asked to summarize it. The next understanding cycle starts fresh,
seeded only with that summary. Optimize for information density.
Each cycle is self-contained - don't reference "previous" understanding.`
