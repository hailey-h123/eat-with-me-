import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TabBar from '../components/TabBar';
import FootprintView from '../components/FootprintView';
import ProfileView from '../components/ProfileView';
import HomeView from '../components/HomeView';

describe('新视图挂载冒烟', () => {
  it('TabBar 渲染 3 个 Tab 并回调', () => {
    const onChange = vi.fn();
    render(<TabBar activeView="home" onChange={onChange} />);
    expect(screen.getByRole('navigation', { name: '主导航' })).toBeTruthy();
    fireEvent.click(screen.getByText('足迹'));
    expect(onChange).toHaveBeenCalledWith('footprint');
  });

  it('FootprintView 渲染 3 个子 Tab', () => {
    render(<FootprintView onReselect={() => {}} />);
    expect(screen.getByText('收藏')).toBeTruthy();
    expect(screen.getByText('去过')).toBeTruthy();
    expect(screen.getByText('搜索历史')).toBeTruthy();
  });

  it('ProfileView 渲染等级卡与徽章', () => {
    render(<ProfileView location={{ name: '望京' }} onOpenFootprint={() => {}} />);
    expect(screen.getAllByText(/Lv\.\d/).length).toBeGreaterThan(0);
    expect(screen.getByText('十连决')).toBeTruthy();
    expect(screen.getByText('辣星人')).toBeTruthy();
  });

  it('HomeView 渲染 4 宫格 + 3 指标 + 附近推荐区', () => {
    const noop = () => {};
    render(<HomeView
      onSelectSolo={noop} onSelectGroup={noop}
      onRandomPick={noop} onFortunePick={noop}
      onOpenProfile={noop} onQuickPick={noop}
      location={{ name: '望京', lat: 39.99, lng: 116.47 }}
    />);
    expect(screen.getByText('一人食')).toBeTruthy();
    expect(screen.getByText('多人聚餐')).toBeTruthy();
    expect(screen.getByText('随便选')).toBeTruthy();
    expect(screen.getByText('抽签吃')).toBeTruthy();
    expect(screen.getByText('收藏')).toBeTruthy();
    expect(screen.getByText('去过')).toBeTruthy();
    expect(screen.getAllByText('今日运势').length).toBe(2); // 指标 + 抽签卡 desc
    expect(screen.getByText(/附近餐厅推荐/)).toBeTruthy();
  });
});
