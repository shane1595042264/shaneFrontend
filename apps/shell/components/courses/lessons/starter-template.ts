/**
 * SHAN-652. What a new lessons course starts with: a two-lesson course about
 * the format itself, so every step type is on screen to copy from and the
 * preview works before the author has written a word.
 */
export const STARTER_CONTENT = {
  version: 1,
  units: [
    {
      id: "basics",
      title: "How a course is put together",
      summary: "Units hold lessons, lessons hold steps. Replace this unit with your own.",
      lessons: [
        {
          id: "steps",
          title: "The five kinds of step",
          steps: [
            {
              type: "teach",
              title: "A lesson is a run of short cards",
              body: "A **teach** card explains one idea. Keep it to a few sentences.\n\nEvery other card is an exercise with one right answer that you write. Nothing is graded by AI.",
            },
            {
              type: "choice",
              prompt: "Which card type explains an idea without asking anything?",
              choices: [
                { text: "teach", correct: true, why: "Teach cards are for reading. Every other type is graded." },
                { text: "choice", why: "Choice asks a question with options." },
                { text: "match", why: "Match asks the learner to pair things up." },
              ],
              explanation: "Mark more than one choice `\"correct\": true` to make it select-all-that-apply.",
            },
            {
              type: "blank",
              prompt: "Fill in the blank",
              text: "Wrap the answer in double brackets, like [[this]]. Alternatives go after a [[bar|pipe]].",
              explanation: "Leave out `bank` and the learner types the answer. Typed answers ignore case and trailing punctuation.",
            },
            {
              type: "blank",
              text: "With a `bank`, the learner taps [[tiles]] instead of typing.",
              bank: ["keys", "cards"],
            },
          ],
        },
        {
          id: "ordering-and-matching",
          title: "Ordering and matching",
          steps: [
            {
              type: "order",
              prompt: "Put the parts of a course from biggest to smallest",
              items: ["Course", "Unit", "Lesson", "Step"],
              explanation: "Write `items` in the right order. The player shuffles them.",
            },
            {
              type: "match",
              prompt: "Match each step type to what the learner does",
              pairs: [
                ["choice", "Picks an option"],
                ["blank", "Fills in missing words"],
                ["order", "Arranges a sequence"],
                ["match", "Pairs two columns"],
              ],
            },
            {
              type: "choice",
              prompt: "What does this print?",
              code: "const steps = [\"teach\", \"choice\", \"blank\"];\nconsole.log(steps.length);",
              language: "js",
              choices: [{ text: "3", correct: true }, { text: "2" }, { text: "undefined" }],
              explanation: "Any exercise can carry a `code` snippet, the CodeSignal shape.",
            },
          ],
        },
      ],
    },
  ],
};

/** One ready-to-edit example of each step type, for the editor's Add step menu. */
export const STEP_SNIPPETS: Record<string, unknown> = {
  teach: { type: "teach", title: "A new idea", body: "Explain one idea in a few sentences." },
  choice: {
    type: "choice",
    prompt: "Your question?",
    choices: [
      { text: "The right answer", correct: true, why: "Why it is right." },
      { text: "A wrong answer", why: "Why it is wrong." },
    ],
  },
  blank: { type: "blank", text: "A sentence with a [[missing|missed]] word." },
  bank: { type: "blank", text: "Tap the [[right]] tile.", bank: ["wrong", "other"] },
  order: { type: "order", prompt: "Put these in order", items: ["First", "Second", "Third"] },
  match: {
    type: "match",
    prompt: "Match the pairs",
    pairs: [
      ["Left one", "Right one"],
      ["Left two", "Right two"],
    ],
  },
};
