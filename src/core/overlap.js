import { DETECTOR_PRIORITY } from './detectors.js';

export function sortByPriority(matches) {
  return (Array.isArray(matches) ? matches : [])
    .map((match, index) => ({ match, index }))
    .sort((left, right) => {
      const leftPriority = getPriority(left.match);
      const rightPriority = getPriority(right.match);

      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }

      const leftLength = getLength(left.match);
      const rightLength = getLength(right.match);

      if (leftLength !== rightLength) {
        return rightLength - leftLength;
      }

      if (left.match.start !== right.match.start) {
        return left.match.start - right.match.start;
      }

      return left.index - right.index;
    })
    .map((item) => item.match);
}

export function resolveOverlaps(matches) {
  const selected = [];

  for (const match of sortByPriority(matches)) {
    if (selected.some((existing) => overlaps(existing, match))) {
      continue;
    }

    selected.push(match);
  }

  return selected.sort((left, right) => {
    if (left.start !== right.start) {
      return left.start - right.start;
    }

    return left.end - right.end;
  });
}

function getPriority(match) {
  if (Number.isFinite(Number(match.resolverPriority))) {
    return Number(match.resolverPriority);
  }

  return Number(match.priority || DETECTOR_PRIORITY[match.type] || 999);
}

function getLength(match) {
  return Math.max(0, Number(match.end) - Number(match.start));
}

function overlaps(left, right) {
  return left.start < right.end && right.start < left.end;
}
