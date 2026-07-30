const STORAGE_KEY = 'eatwithme_vote_session';

export function createVoteSession(restaurants, members) {
  const session = {
    id: Date.now().toString(),
    restaurants: restaurants.map(r => ({
      id: r.id,
      name: r.name,
      votes: 0,
      voters: []
    })),
    members: members.map(m => m.name),
    createdAt: Date.now(),
    votes: {}
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  return session;
}

export function getVoteSession() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('[voteService] 读取投票会话失败:', error);
    return null;
  }
}

export function castVote(restaurantId, voterName) {
  const session = getVoteSession();
  if (!session) return null;

  const restaurant = session.restaurants.find(r => r.id === restaurantId);
  if (!restaurant) return null;

  const existingVote = session.votes[voterName];
  if (existingVote) {
    const prevRestaurant = session.restaurants.find(r => r.id === existingVote);
    if (prevRestaurant) {
      prevRestaurant.votes--;
      prevRestaurant.voters = prevRestaurant.voters.filter(v => v !== voterName);
    }
  }

  restaurant.votes++;
  restaurant.voters.push(voterName);
  session.votes[voterName] = restaurantId;

  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  return session;
}

export function endVoteSession() {
  const session = getVoteSession();
  localStorage.removeItem(STORAGE_KEY);
  return session;
}

export function getVoteResults() {
  const session = getVoteSession();
  if (!session) return null;

  const sorted = [...session.restaurants].sort((a, b) => b.votes - a.votes);
  const totalVoters = Object.keys(session.votes).length;
  
  return {
    winner: sorted[0],
    results: sorted,
    totalVoters,
    totalVotes: sorted.reduce((sum, r) => sum + r.votes, 0)
  };
}