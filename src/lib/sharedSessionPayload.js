import { CATEGORIES } from "./constants.js";
import { DECK_POLICIES, GUESS_POLICIES } from "./sessionModel.js";

const SHARED_SESSION_VERSION = 1;
const SHARED_PREFIX = "MSHARE1";

function toBase64Url(value) {
  if (typeof window !== "undefined" && typeof window.btoa === "function") {
    return window.btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  return Buffer.from(value, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const paddedValue = `${value}`.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");

  if (typeof window !== "undefined" && typeof window.atob === "function") {
    return window.atob(paddedValue);
  }

  return Buffer.from(paddedValue, "base64").toString("utf8");
}

function isKnownCategory(category) {
  return Boolean(CATEGORIES[category]);
}

function isKnownGuessPolicy(guessPolicy) {
  return Object.values(GUESS_POLICIES).includes(guessPolicy);
}

function isKnownDeckPolicy(deckPolicy) {
  return Object.values(DECK_POLICIES).includes(deckPolicy);
}

function getCategoryOptionNames(category) {
  return CATEGORIES[category]?.items?.map((item) => item.name) ?? [];
}

function validateSharedSessionPayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Shared session code is not a valid object.");
  }

  if (payload.version !== SHARED_SESSION_VERSION) {
    throw new Error("Shared session code version is not supported.");
  }

  if (!isKnownCategory(payload.category)) {
    throw new Error("Shared session category is not recognized.");
  }

  if (!Array.isArray(payload.optionValues) || payload.optionValues.length === 0) {
    throw new Error("Shared session code is missing active options.");
  }

  const knownOptionNames = new Set(getCategoryOptionNames(payload.category));
  if (payload.optionValues.some((optionValue) => !knownOptionNames.has(optionValue))) {
    throw new Error("Shared session code contains an invalid option for the selected category.");
  }

  if (!Number.isInteger(payload.cardsPerRound) || payload.cardsPerRound < 1) {
    throw new Error("Shared session code contains an invalid cards-per-round value.");
  }

  if (!Number.isInteger(payload.resumeIndex) || payload.resumeIndex < 0 || payload.resumeIndex > payload.cardsPerRound) {
    throw new Error("Shared session code contains an invalid resume position.");
  }

  if (!isKnownGuessPolicy(payload.guessPolicy)) {
    throw new Error("Shared session code contains an invalid guess policy.");
  }

  if (!isKnownDeckPolicy(payload.deckPolicy)) {
    throw new Error("Shared session code contains an invalid deck policy.");
  }

  if (!Array.isArray(payload.deckOrder) || payload.deckOrder.length !== payload.cardsPerRound) {
    throw new Error("Shared session code is missing the finalized deck order.");
  }

  if (payload.deckOrder.some((targetValue) => !knownOptionNames.has(targetValue))) {
    throw new Error("Shared session code contains an invalid card target.");
  }
}

export function buildSharedSessionPayload({
  category,
  optionValues,
  cardsPerRound,
  resumeIndex = 0,
  guessPolicy,
  deckPolicy,
  deckOrder,
}) {
  const payload = {
    version: SHARED_SESSION_VERSION,
    category,
    optionValues: [...optionValues],
    cardsPerRound,
    resumeIndex,
    guessPolicy,
    deckPolicy,
    deckOrder: [...deckOrder],
  };

  validateSharedSessionPayload(payload);

  return `${SHARED_PREFIX}.${toBase64Url(JSON.stringify(payload))}`;
}

export function parseSharedSessionPayload(sharedCode) {
  if (typeof sharedCode !== "string" || !sharedCode.trim()) {
    throw new Error("Shared session code is empty.");
  }

  const trimmedCode = sharedCode.trim();
  const [prefix, encodedPayload] = trimmedCode.split(".", 2);

  if (prefix !== SHARED_PREFIX || !encodedPayload) {
    throw new Error("Shared session code format is not recognized.");
  }

  let parsedPayload;

  try {
    parsedPayload = JSON.parse(fromBase64Url(encodedPayload));
  } catch (error) {
    throw new Error("Shared session code could not be decoded.");
  }

  if (!Object.prototype.hasOwnProperty.call(parsedPayload, "resumeIndex")) {
    parsedPayload.resumeIndex = 0;
  }

  validateSharedSessionPayload(parsedPayload);
  return parsedPayload;
}

export function looksLikeSharedSessionPayload(sharedCode) {
  return typeof sharedCode === "string" && sharedCode.trim().startsWith(`${SHARED_PREFIX}.`);
}
