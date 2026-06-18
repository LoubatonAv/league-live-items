const recommendationHistory = new Map();

const getRecommendationHistory = (key) => {
  return key ? recommendationHistory.get(key) || null : null;
};

const setRecommendationHistory = (key, value) => {
  if (key) {
    recommendationHistory.set(key, value);
  }
};

const clearRecommendationHistory = () => {
  recommendationHistory.clear();
};

module.exports = {
  getRecommendationHistory,
  setRecommendationHistory,
  clearRecommendationHistory,
};
