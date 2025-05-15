import { Anchor, BarChart3, Blocks, Clock3, Coins, Compass, Dice5, FileSearch, Gift, Heart, Home, LayoutDashboard, ListOrdered, Megaphone, Rocket, Settings, Shield, ShieldAlert, Sparkles, Tag, Trophy, Users, Wallet, Workflow } from 'lucide-react';

export const playerNav = [
  { label: 'Home', href: '/', icon: Home },
  { label: 'Casino lobby', href: '/casino', icon: Compass },
  { label: 'Slots', href: '/casino/slots', icon: Sparkles },
  { label: 'Roulette', href: '/casino/roulette', icon: Anchor },
  { label: 'Dice', href: '/casino/dice', icon: Dice5 },
  { label: 'Crash', href: '/casino/crash', icon: Rocket },
  { label: 'Providers', href: '/casino/providers', icon: Blocks },
];
export const playerAccountNav = [
  { label: 'Favourites', href: '/favorites', icon: Heart },
  { label: 'Recently played', href: '/recent', icon: Clock3 },
  { label: 'Promotions', href: '/promotions', icon: Megaphone },
  { label: 'Bonuses', href: '/bonuses', icon: Gift },
  { label: 'Loyalty', href: '/loyalty', icon: Trophy },
  { label: 'Wallet', href: '/wallet', icon: Wallet },
  { label: 'Responsible gaming', href: '/responsible-gaming', icon: Shield },
];
export const adminNav = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Players', href: '/admin/players', icon: Users },
  { label: 'Games', href: '/admin/games', icon: Sparkles },
  { label: 'Providers', href: '/admin/providers', icon: Blocks },
  { label: 'Sessions', href: '/admin/sessions', icon: Workflow },
  { label: 'Rounds', href: '/admin/rounds', icon: ListOrdered },
  { label: 'Transactions', href: '/admin/transactions', icon: Coins },
  { label: 'Bonuses', href: '/admin/bonuses', icon: Gift },
  { label: 'Promotions', href: '/admin/promotions', icon: Tag },
  { label: 'Risk', href: '/admin/risk', icon: ShieldAlert },
  { label: 'Audit log', href: '/admin/audit', icon: FileSearch },
  { label: 'Settings', href: '/admin/settings', icon: Settings },
];
export const adminIcons = { BarChart3 };
