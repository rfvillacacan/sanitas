import { createDsnMatchesForRule } from './dsn_matchers.js';

export function detectDsnEntities(inputText, options = {}) {
  const input = String(inputText || '');
  const rulesets = getRulesets(options);
  const matches = [];

  if (!input || rulesets.length === 0) {
    return matches;
  }

  for (const ruleset of rulesets) {
    for (const rule of Array.isArray(ruleset.rules) ? ruleset.rules : []) {
      matches.push(...createDsnMatchesForRule(input, rule));
    }
  }

  return matches.sort((left, right) => {
    if (left.start !== right.start) {
      return left.start - right.start;
    }

    return right.end - right.start - (left.end - left.start);
  });
}

function getRulesets(options = {}) {
  if (Array.isArray(options.dsnRulesets)) {
    return options.dsnRulesets.filter(Boolean);
  }

  if (options.dsnRules && Array.isArray(options.dsnRules.rulesets)) {
    return options.dsnRules.rulesets.filter(Boolean);
  }

  return [];
}
