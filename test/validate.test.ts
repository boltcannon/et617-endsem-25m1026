import { test } from "node:test";
import assert from "node:assert/strict";
import { validateStory, validateFeedback } from "../lib/validate.ts";

test("story: must keep exactly the given numbers, no question, no working", () => {
  assert.equal(validateStory("Neha buys notebooks for ₹1000 and sells them for ₹1100 at her stall.", [1000, 1100]), true);
  assert.equal(validateStory("Neha buys notebooks for ₹1000 and sells them for ₹1200 at her stall.", [1000, 1100]), false); // invented number
  assert.equal(validateStory("Neha buys notebooks for ₹1000 at her stall in the market.", [1000, 1100]), false); // missing number
  assert.equal(validateStory("Neha buys notebooks for ₹1000 and sells for ₹1100. What is the profit?", [1000, 1100]), false); // question
});

test("feedback: one warm sentence, no digits, no verdict", () => {
  assert.equal(validateFeedback("Thanks for putting your idea into words, that takes effort."), true);
  assert.equal(validateFeedback("Great job spotting the 30 percent idea!"), false);
  assert.equal(validateFeedback("That gives $800 which is less than the straight discount."), false);
  assert.equal(validateFeedback("Nice try. You are right about this."), false);
  assert.equal(validateFeedback("Thanks for trying. Let us look again. Keep going."), false); // 3 sentences
});

test("feedback: verdict words are blocked even in a single sentence", () => {
  assert.equal(validateFeedback("You are right about how you thought it through."), false);
  assert.equal(validateFeedback("Thanks for sharing what you were thinking, I know that is hard."), true); // 'know' is not 'no'
});
