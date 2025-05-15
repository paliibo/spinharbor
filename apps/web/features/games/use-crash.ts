'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CrashBetDto, CrashHistoryItem, CrashRoundDto, CrashRoundStatus } from '@spinharbor/contracts';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { apiGet, apiPost } from '@/lib/api';
import { qk } from '@/lib/query-keys';
import { getSocket } from '@/lib/socket';
import { newIdempotencyKey } from '@/lib/utils';
import { useAuthStore } from '@/features/auth/auth-store';
import { useApplyWallet } from '@/features/wallet/use-wallet';
import { gameErrorMessage } from './errors';

/** Shape of GET /games/crash/my-bets items (not in the shared contracts). */
export interface CrashMyBetDto {
  id: string;
  roundSeq: number;
  stakeMinor: number;
  status: CrashBetDto['status'];
  cashoutMultiplierBp: number | null;
  payoutMinor: number;
  crashMultiplierBp: number | null;
  createdAt: string;
}

const GROWTH_K = Math.LN2 / 10_000; // m(t) = 2^(t / 10s)

/** Client-side mirror of the engine formula, used only to interpolate between server ticks. */
export function crashMultiplierAt(elapsedMs: number): number {
  if (elapsedMs <= 0) return 10_000;
  return Math.floor(10_000 * Math.exp(GROWTH_K * elapsedMs));
}

export type CrashPhase = CrashRoundStatus | 'OFFLINE';

interface TickRef {
  roundId: string;
  multiplierBp: number;
  elapsedMs: number;
  localAt: number;
}

export function useCrash() {
  const qc = useQueryClient();
  const applyWallet = useApplyWallet();
  const me = useAuthStore((s) => s.user);
  const [round, setRound] = useState<CrashRoundDto | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  /** Animation frame snapshot: local clock plus the latest server offset/tick, copied from refs outside render. */
  const [frame, setFrame] = useState<{ now: number; offset: number; tick: TickRef | null }>(() => ({ now: Date.now(), offset: 0, tick: null }));
  const offsetRef = useRef(0); // serverTime - Date.now()
  const tickRef = useRef<TickRef | null>(null);
  const roundRef = useRef<CrashRoundDto | null>(null);
  const lastEventRef = useRef<{ kind: 'crashed' | 'cashed_out' | 'bet_placed'; bet?: CrashBetDto; roundId: string; crashMultiplierBp?: number; at: number } | null>(null);
  const [lastEvent, setLastEvent] = useState<typeof lastEventRef.current>(null);

  // Initial snapshot over HTTP so the UI renders before the socket handshake completes.
  const stateQuery = useQuery({ queryKey: qk.crashState, queryFn: () => apiGet<CrashRoundDto | null>('/games/crash/state'), staleTime: Infinity, retry: 1 });
  const historyQuery = useQuery({ queryKey: qk.crashHistory, queryFn: () => apiGet<CrashHistoryItem[]>('/games/crash/history'), staleTime: 30_000 });
  const myBetsQuery = useQuery({ queryKey: qk.crashMyBets, queryFn: () => apiGet<CrashMyBetDto[]>('/games/crash/my-bets'), staleTime: 10_000, enabled: !!me });

  const applySnapshot = useCallback((snap: CrashRoundDto | null) => {
    if (!snap) return;
    offsetRef.current = new Date(snap.serverTime).getTime() - Date.now();
    if (!roundRef.current || roundRef.current.id !== snap.id) tickRef.current = null;
    roundRef.current = snap;
    setRound(snap);
    setFrame({ now: Date.now(), offset: offsetRef.current, tick: tickRef.current });
  }, []);

  useEffect(() => {
    if (stateQuery.data && !roundRef.current) applySnapshot(stateQuery.data);
  }, [stateQuery.data, applySnapshot]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket.connected) socket.connect();

    const subscribe = () => {
      socket.emit('crash:subscribe', (snap) => {
        applySnapshot(snap);
        setConnected(true);
      });
    };
    const onConnect = () => {
      setConnected(true);
      subscribe();
    };
    const onDisconnect = () => setConnected(false);
    const onState = (snap: CrashRoundDto) => applySnapshot(snap);
    const onTick = (p: { roundId: string; multiplierBp: number; elapsedMs: number; serverTime: string }) => {
      if (!roundRef.current || p.roundId !== roundRef.current.id) return;
      offsetRef.current = new Date(p.serverTime).getTime() - Date.now();
      tickRef.current = { roundId: p.roundId, multiplierBp: p.multiplierBp, elapsedMs: p.elapsedMs, localAt: Date.now() };
      if (roundRef.current.status !== 'RUNNING') {
        const next = { ...roundRef.current, status: 'RUNNING' as const };
        roundRef.current = next;
        setRound(next);
      }
    };
    const upsertBet = (roundId: string, bet: CrashBetDto) => {
      const cur = roundRef.current;
      if (!cur || cur.id !== roundId) return;
      const idx = cur.bets.findIndex((b) => b.id === bet.id || b.userId === bet.userId);
      const bets = idx >= 0 ? cur.bets.map((b, i) => (i === idx ? bet : b)) : [...cur.bets, bet];
      const next = { ...cur, bets };
      roundRef.current = next;
      setRound(next);
    };
    const onBetPlaced = (p: { roundId: string; bet: CrashBetDto }) => {
      upsertBet(p.roundId, p.bet);
      const ev = { kind: 'bet_placed' as const, bet: p.bet, roundId: p.roundId, at: Date.now() };
      lastEventRef.current = ev;
      setLastEvent(ev);
    };
    const onCashedOut = (p: { roundId: string; bet: CrashBetDto }) => {
      upsertBet(p.roundId, p.bet);
      const ev = { kind: 'cashed_out' as const, bet: p.bet, roundId: p.roundId, at: Date.now() };
      lastEventRef.current = ev;
      setLastEvent(ev);
      if (me && p.bet.userId === me.id) qc.invalidateQueries({ queryKey: qk.crashMyBets });
    };
    const onCrashed = (p: { roundId: string; crashMultiplierBp: number; serverSeed: string; history: CrashHistoryItem[] }) => {
      qc.setQueryData<CrashHistoryItem[]>(qk.crashHistory, p.history);
      const cur = roundRef.current;
      if (cur && cur.id === p.roundId) {
        const next: CrashRoundDto = {
          ...cur,
          status: 'CRASHED',
          crashMultiplierBp: p.crashMultiplierBp,
          serverSeed: p.serverSeed,
          crashedAt: cur.crashedAt ?? new Date(Date.now() + offsetRef.current).toISOString(),
          bets: cur.bets.map((b) => (b.status === 'PLACED' ? { ...b, status: 'LOST' as const } : b)),
        };
        roundRef.current = next;
        setRound(next);
      }
      const ev = { kind: 'crashed' as const, roundId: p.roundId, crashMultiplierBp: p.crashMultiplierBp, at: Date.now() };
      lastEventRef.current = ev;
      setLastEvent(ev);
      qc.invalidateQueries({ queryKey: qk.crashMyBets });
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('crash:state', onState);
    socket.on('crash:tick', onTick);
    socket.on('crash:bet_placed', onBetPlaced);
    socket.on('crash:cashed_out', onCashedOut);
    socket.on('crash:crashed', onCrashed);
    if (socket.connected) subscribe();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('crash:state', onState);
      socket.off('crash:tick', onTick);
      socket.off('crash:bet_placed', onBetPlaced);
      socket.off('crash:cashed_out', onCashedOut);
      socket.off('crash:crashed', onCrashed);
      if (socket.connected) socket.emit('crash:unsubscribe');
    };
  }, [applySnapshot, qc, me]);

  // Animation clock: drives interpolation (RUNNING) and countdowns (WAITING / BETTING_OPEN).
  const status = round?.status;
  useEffect(() => {
    if (!status || status === 'SETTLED' || status === 'CRASHED') return;
    let raf = 0;
    const loop = () => {
      setFrame({ now: Date.now(), offset: offsetRef.current, tick: tickRef.current });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status]);

  const { now, offset, tick: lastTick } = frame;
  const serverNow = now + offset;
  const startsAtMs = round ? new Date(round.startsAt).getTime() : 0;
  const bettingOpensAtMs = round ? new Date(round.bettingOpensAt).getTime() : 0;

  let multiplierBp = 10_000;
  let elapsedMs = 0;
  if (round) {
    if (round.status === 'RUNNING') {
      const tick = lastTick && lastTick.roundId === round.id ? lastTick : null;
      elapsedMs = tick ? tick.elapsedMs + (now - tick.localAt) : Math.max(0, serverNow - startsAtMs);
      multiplierBp = crashMultiplierAt(elapsedMs);
      if (tick && multiplierBp < tick.multiplierBp) multiplierBp = tick.multiplierBp;
    } else if ((round.status === 'CRASHED' || round.status === 'SETTLED') && round.crashMultiplierBp) {
      multiplierBp = round.crashMultiplierBp;
      elapsedMs = round.crashedAt ? new Date(round.crashedAt).getTime() - startsAtMs : Math.log(multiplierBp / 10_000) / GROWTH_K;
    }
  }

  const countdownMs = round ? (round.status === 'BETTING_OPEN' ? Math.max(0, startsAtMs - serverNow) : round.status === 'WAITING' ? Math.max(0, bettingOpensAtMs - serverNow) : 0) : 0;
  const phase: CrashPhase = !connected && !round ? 'OFFLINE' : (round?.status ?? 'WAITING');
  const myBet = useMemo(() => (round && me ? (round.bets.find((b) => b.userId === me.id) ?? null) : null), [round, me]);

  const placeMutation = useMutation({
    mutationFn: (input: { roundId: string; stakeMinor: number; autoCashoutBp?: number }) =>
      apiPost<{ bet: CrashBetDto; wallet: { balanceMinor: number; bonusBalanceMinor: number; version: number } }>('/games/crash/bet', {
        ...input,
        idempotencyKey: newIdempotencyKey('crash-bet'),
      }),
    onSuccess: (res, vars) => {
      applyWallet(res.wallet);
      const cur = roundRef.current;
      if (cur && cur.id === vars.roundId && !cur.bets.some((b) => b.id === res.bet.id)) {
        const next = { ...cur, bets: [...cur.bets, res.bet] };
        roundRef.current = next;
        setRound(next);
      }
      qc.invalidateQueries({ queryKey: qk.crashMyBets });
    },
    onError: (e) => toast.error(gameErrorMessage(e)),
  });

  const cashoutMutation = useMutation({
    mutationFn: (input: { roundId: string }) =>
      apiPost<{ bet: CrashBetDto; wallet: { balanceMinor: number; bonusBalanceMinor: number; version: number } }>('/games/crash/cashout', input),
    onSuccess: (res, vars) => {
      applyWallet(res.wallet);
      const cur = roundRef.current;
      if (cur && cur.id === vars.roundId) {
        const next = { ...cur, bets: cur.bets.map((b) => (b.id === res.bet.id ? res.bet : b)) };
        roundRef.current = next;
        setRound(next);
      }
      qc.invalidateQueries({ queryKey: qk.crashMyBets });
    },
    onError: (e) => toast.error(gameErrorMessage(e)),
  });

  const place = useCallback(
    (stakeMinor: number, autoCashoutBp?: number) => {
      const cur = roundRef.current;
      if (!cur) return Promise.reject(new Error('No round'));
      return placeMutation.mutateAsync({ roundId: cur.id, stakeMinor, ...(autoCashoutBp ? { autoCashoutBp } : {}) });
    },
    [placeMutation],
  );
  const cashout = useCallback(() => {
    const cur = roundRef.current;
    if (!cur) return Promise.reject(new Error('No round'));
    return cashoutMutation.mutateAsync({ roundId: cur.id });
  }, [cashoutMutation]);

  return {
    round,
    phase,
    connected,
    multiplierBp,
    elapsedMs,
    countdownMs,
    history: historyQuery.data ?? [],
    myBets: myBetsQuery.data ?? [],
    myBet,
    me,
    lastEvent,
    place,
    cashout,
    placing: placeMutation.isPending,
    cashingOut: cashoutMutation.isPending,
    loading: !round && stateQuery.isPending,
  };
}
