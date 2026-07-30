import { useState, useEffect } from 'react';
import { IconArrowLeft, IconCheck, IconUsers, IconTrophy, IconRefreshCw, IconVote } from './icons/FancyIcons';
import { createVoteSession, getVoteSession, castVote, getVoteResults, endVoteSession } from '../services/voteService';

export default function VoteView({ restaurants, members, onBack, onSelect }) {
  const [voteSession, setVoteSession] = useState(null);
  const [currentVoter, setCurrentVoter] = useState('');
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    let session = getVoteSession();
    if (!session && restaurants && members) session = createVoteSession(restaurants, members);
    setVoteSession(session);
  }, [restaurants, members]);

  useEffect(() => {
    if (showResults && voteSession) {
      const results = getVoteResults();
      if (results && results.winner) {
        const winningRestaurant = restaurants.find(r => r.id === results.winner.id);
        if (winningRestaurant && onSelect) setTimeout(() => onSelect(winningRestaurant), 2000);
      }
    }
  }, [showResults, voteSession, restaurants, onSelect]);

  const handleVote = (restaurantId) => {
    if (!currentVoter.trim()) return;
    const updated = castVote(restaurantId, currentVoter.trim());
    setVoteSession(updated);
    setCurrentVoter('');
  };
  const handleEndVote = () => setShowResults(true);
  const handleReset = () => {
    endVoteSession();
    const session = createVoteSession(restaurants, members);
    setVoteSession(session);
    setShowResults(false);
  };

  if (!voteSession) return <div className="max-w-lg mx-auto px-6 py-12 text-center fade-in"><p className="text-text-muted">正在初始化投票...</p></div>;

  const results = getVoteResults();

  const voteBadgeClass = isVoted => isVoted
    ? 'bg-primary text-white border-2 border-ink shadow-[2px_2px_0_var(--color-ink)]'
    : 'bg-bg-soft text-text-secondary border-2 border-ink';
  const rankClass = index => {
    if (index === 0) return 'bg-primary text-white border-2 border-ink shadow-[2px_2px_0_var(--color-ink)]';
    if (index === 1) return 'bg-secondary text-white border-2 border-ink shadow-[2px_2px_0_var(--color-ink)]';
    if (index === 2) return 'bg-accent text-text border-2 border-ink shadow-[2px_2px_0_var(--color-ink)]';
    return 'bg-bg-soft text-text-secondary border-2 border-ink';
  };

  return (
    <div className="max-w-lg mx-auto px-6">
      <div className="flex items-center justify-between mb-6 fade-in">
        <button onClick={onBack} className="text-primary text-sm font-medium flex items-center gap-1.5" style={{ fontFamily: 'var(--font-display)' }}>
          <IconArrowLeft className="w-4 h-4" /> 返回
        </button>
        {!showResults && (
          <button onClick={handleEndVote} className="btn-primary px-4 py-2 text-sm">
            结束投票
          </button>
        )}
      </div>

      {!showResults ? (
        <>
          <div className="fancy-card p-5 mb-6 animate-slide-up">
            <div className="flex items-center gap-2 mb-2.5">
              <IconVote className="w-5 h-5 text-primary" />
              <h2 className="font-bold text-primary" style={{ fontFamily: 'var(--font-display)' }}>开始投票</h2>
            </div>
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <IconUsers className="w-4 h-4" />
              <span>参与成员: {members.map(m => m.name).join(', ')}</span>
            </div>
          </div>

          <div className="mb-4 animate-slide-up">
            <input type="text" value={currentVoter} onChange={e => setCurrentVoter(e.target.value)}
              placeholder="输入你的名字进行投票"
              className="input-field w-full px-4 py-3 text-sm text-text placeholder:text-text-muted" />
          </div>

          <div className="space-y-3">
            {voteSession.restaurants.map((item, i) => {
              const restaurant = restaurants.find(r => r.id === item.id);
              const isVoted = item.voters.includes(currentVoter.trim());
              return (
                <div key={item.id}
                  className={`fancy-card p-4 cursor-pointer transition-all duration-200 animate-slide-up ${isVoted ? 'border-primary' : ''}`}
                  style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'both' }}
                  onClick={() => handleVote(item.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm transition-all duration-200 ${voteBadgeClass(isVoted)}`}>
                        {item.votes}
                      </div>
                      <div>
                        <h3 className="font-semibold text-text" style={{ fontFamily: 'var(--font-display)' }}>{item.name}</h3>
                        {restaurant && <p className="text-xs text-text-secondary mt-0.5">{restaurant.cuisine} · 人均{restaurant.price}元</p>}
                      </div>
                    </div>
                    {isVoted && (
                      <div className="bg-primary text-white w-6 h-6 rounded-full flex items-center justify-center animate-scale-in border-2 border-ink shadow-[2px_2px_0_var(--color-ink)]">
                        <IconCheck className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                  {item.voters.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1">
                      {item.voters.map(voter => (
                        <span key={voter} className="tag-pill text-xs px-2 py-0.5">{voter}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="text-center animate-fade-in">
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-primary/10 text-primary mb-4 border-2 border-ink shadow-[4px_4px_0_var(--color-ink)]">
              <IconTrophy className="w-10 h-10" />
            </div>
            <h2 className="text-xl font-bold text-text mb-1.5" style={{ fontFamily: 'var(--font-display)' }}>投票结果</h2>
            <p className="text-text-secondary text-sm">共 {results?.totalVoters || 0} 人参与投票</p>
          </div>

          <div className="fancy-card p-6 mb-6">
            <p className="text-sm text-primary mb-2 font-medium">获胜餐厅</p>
            <h3 className="text-2xl font-bold text-text" style={{ fontFamily: 'var(--font-display)' }}>{results?.winner?.name}</h3>
            <p className="text-text-secondary mt-2 text-sm">获得 {results?.winner?.votes || 0} 票</p>
          </div>

          <div className="space-y-2 mb-6">
            {results?.results?.map((item, index) => (
              <div key={item.id}
                className={`fancy-card p-3.5 transition-all duration-200 animate-slide-up ${index === 0 ? 'border-primary' : ''}`}
                style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'both' }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${rankClass(index)}`}>
                      {index + 1}
                    </span>
                    <span className="text-text text-sm font-medium">{item.name}</span>
                  </div>
                  <span className={`font-semibold text-sm ${index === 0 ? 'text-primary' : 'text-text-secondary'}`}>{item.votes} 票</span>
                </div>
              </div>
            ))}
          </div>

          <button onClick={handleReset} className="btn-primary px-6 py-2.5 text-sm">
            重新投票
          </button>
        </div>
      )}
    </div>
  );
}