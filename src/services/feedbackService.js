const FEEDBACK_KEY = 'eatwithme_user_feedback';

const MAX_FEEDBACK_ITEMS = 50;

export function getFeedback() {
  try {
    const data = localStorage.getItem(FEEDBACK_KEY);
    if (!data) return { likes: [], dislikes: [] };
    const parsed = JSON.parse(data);
    return {
      likes: parsed.likes || [],
      dislikes: parsed.dislikes || []
    };
  } catch {
    return { likes: [], dislikes: [] };
  }
}

export function addLike(restaurant) {
  try {
    const feedback = getFeedback();
    const cuisine = restaurant.cuisine || '';
    const tags = restaurant.tags || [];
    const features = restaurant.features || [];
    const allTags = [...tags, ...features, cuisine].filter(Boolean);
    
    feedback.likes.unshift({
      id: restaurant.id,
      name: restaurant.name,
      cuisine,
      tags: allTags,
      price: restaurant.price || 0,
      timestamp: Date.now()
    });
    
    feedback.likes = feedback.likes.slice(0, MAX_FEEDBACK_ITEMS);
    localStorage.setItem(FEEDBACK_KEY, JSON.stringify(feedback));
  } catch {}
}

export function addDislike(restaurant) {
  try {
    const feedback = getFeedback();
    const cuisine = restaurant.cuisine || '';
    const tags = restaurant.tags || [];
    const features = restaurant.features || [];
    const allTags = [...tags, ...features, cuisine].filter(Boolean);
    
    feedback.dislikes.unshift({
      id: restaurant.id,
      name: restaurant.name,
      cuisine,
      tags: allTags,
      price: restaurant.price || 0,
      timestamp: Date.now()
    });
    
    feedback.dislikes = feedback.dislikes.slice(0, MAX_FEEDBACK_ITEMS);
    localStorage.setItem(FEEDBACK_KEY, JSON.stringify(feedback));
  } catch {}
}

export function hasLiked(restaurantId) {
  const feedback = getFeedback();
  return feedback.likes.some(item => item.id === restaurantId);
}

export function removeLike(restaurantId) {
  try {
    const feedback = getFeedback();
    feedback.likes = feedback.likes.filter(item => item.id !== restaurantId);
    localStorage.setItem(FEEDBACK_KEY, JSON.stringify(feedback));
  } catch {}
}

export function hasDisliked(restaurantId) {
  const feedback = getFeedback();
  return feedback.dislikes.some(item => item.id === restaurantId);
}

export function removeDislike(restaurantId) {
  try {
    const feedback = getFeedback();
    feedback.dislikes = feedback.dislikes.filter(item => item.id !== restaurantId);
    localStorage.setItem(FEEDBACK_KEY, JSON.stringify(feedback));
  } catch {}
}

export function getFeedbackWeights() {
  const feedback = getFeedback();
  const weights = {
    cuisineBoost: {},
    cuisinePenalty: {},
    tagBoost: {},
    tagPenalty: {}
  };

  feedback.likes.forEach(item => {
    if (item.cuisine) {
      weights.cuisineBoost[item.cuisine] = (weights.cuisineBoost[item.cuisine] || 0) + 1;
    }
    (item.tags || []).forEach(tag => {
      if (tag && tag.length > 1 && tag.length < 10) {
        weights.tagBoost[tag] = (weights.tagBoost[tag] || 0) + 0.3;
      }
    });
  });

  feedback.dislikes.forEach(item => {
    if (item.cuisine) {
      weights.cuisinePenalty[item.cuisine] = (weights.cuisinePenalty[item.cuisine] || 0) + 1;
    }
    (item.tags || []).forEach(tag => {
      if (tag && tag.length > 1 && tag.length < 10) {
        weights.tagPenalty[tag] = (weights.tagPenalty[tag] || 0) + 0.3;
      }
    });
  });

  return weights;
}

export function applyFeedbackToScore(restaurant, baseScore) {
  const weights = getFeedbackWeights();
  let adjustedScore = baseScore;
  const cuisine = restaurant.cuisine || '';
  const tags = [...(restaurant.tags || []), ...(restaurant.features || [])];

  if (cuisine && weights.cuisineBoost[cuisine]) {
    const boost = Math.min(weights.cuisineBoost[cuisine] * 2, 8);
    adjustedScore += boost;
  }

  if (cuisine && weights.cuisinePenalty[cuisine]) {
    const penalty = Math.min(weights.cuisinePenalty[cuisine] * 3, 10);
    adjustedScore -= penalty;
  }

  tags.forEach(tag => {
    if (weights.tagBoost[tag]) {
      adjustedScore += Math.min(weights.tagBoost[tag], 3);
    }
    if (weights.tagPenalty[tag]) {
      adjustedScore -= Math.min(weights.tagPenalty[tag], 4);
    }
  });

  return Math.max(0, Math.min(100, adjustedScore));
}
