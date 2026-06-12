// ─── Database row types (mirror Supabase schema) ───────────────────────────

export type DraftMode = "live" | "slow";
export type DraftStatus = "pending" | "active" | "completed";
export type TransferWindowStatus = "open" | "closed";
export type PlayerPosition = "GK" | "DEF" | "MID" | "FWD";

export interface League {
  id: string;
  name: string;
  invite_code: string;
  commissioner_id: string;
  draft_mode: DraftMode;
  draft_status: DraftStatus;
  draft_order: string[]; // array of user_ids in order
  current_pick_index: number;
  pick_time_limit_seconds: number; // for live mode
  slow_draft_hours: number; // hours per pick for slow mode
  current_pick_deadline: string | null; // ISO timestamp
  max_participants: number;
  created_at: string;
  team_pick_index: number;       // how many national team picks have been made
  team_pick_offers: string[];    // UUID[] of teams currently on offer
}

export interface LeagueMember {
  id: string;
  league_id: string;
  user_id: string;
  display_name: string;
  total_points: number;
  goals_scored: number;
  assists: number;
  bonus_points: number;
  joined_at: string;
}

export interface NationalTeam {
  id: string;
  name: string;
  code: string; // e.g. "BRA", "FRA"
  flag_url: string;
  is_eliminated: boolean;
}

export interface Player {
  id: string;
  api_football_id: number;
  name: string;
  position: PlayerPosition;
  team_id: string;
  team?: NationalTeam;
  goals: number;
  assists: number;
  clean_sheets: number;
  total_points: number;
}

export interface SquadPlayer {
  id: string;
  league_id: string;
  manager_id: string; // user_id
  player_id: string;
  player?: Player;
  drafted_at: string;
}

export interface TransferWindow {
  id: string;
  league_id: string;
  opens_at: string;
  closes_at: string;
  status: TransferWindowStatus;
}

export interface Transfer {
  id: string;
  league_id: string;
  manager_id: string;
  player_out_id: string;
  player_in_id: string;
  transfer_window_id: string;
  confirmed_at: string;
  player_out?: Player;
  player_in?: Player;
}

export interface DraftPick {
  id: string;
  league_id: string;
  manager_id: string;
  player_id: string;
  pick_number: number;
  picked_at: string;
  player?: Player;
}

// ─── Scoring constants ───────────────────────────────────────────────────────

export const POINTS = {
  GOAL: 4,
  ASSIST: 3,
  CLEAN_SHEET: 3, // GK and DEF only
} as const;

export function calculatePlayerPoints(
  goals: number,
  assists: number,
  cleanSheets: number,
  position: PlayerPosition
): number {
  const cleanSheetPoints =
    position === "GK" || position === "DEF" ? cleanSheets * POINTS.CLEAN_SHEET : 0;
  return goals * POINTS.GOAL + assists * POINTS.ASSIST + cleanSheetPoints;
}

// ─── Tiebreaker helpers ──────────────────────────────────────────────────────

export interface ManagerStanding {
  manager_id: string;
  display_name: string;
  total_points: number;
  goals_scored: number;
  assists: number;
  highest_individual_player_points: number;
}

export function rankManagers(managers: ManagerStanding[]): ManagerStanding[] {
  return [...managers].sort((a, b) => {
    if (b.total_points !== a.total_points) return b.total_points - a.total_points;
    if (b.goals_scored !== a.goals_scored) return b.goals_scored - a.goals_scored;
    if (b.assists !== a.assists) return b.assists - a.assists;
    return b.highest_individual_player_points - a.highest_individual_player_points;
  });
}

// ─── Transfer validation ─────────────────────────────────────────────────────

export interface TransferValidationInput {
  playerIn: Player;
  playerOut: Player;
  currentSquad: Player[];
  allSquads: { manager_id: string; players: Player[] }[];
  managerId: string;
}

export type TransferValidationResult =
  | { valid: true }
  | { valid: false; reason: string };

export function validateTransfer({
  playerIn,
  playerOut,
  currentSquad,
  allSquads,
  managerId,
}: TransferValidationInput): TransferValidationResult {
  if (playerIn.team?.is_eliminated) {
    return { valid: false, reason: "Player's national team has been eliminated." };
  }

  const isDraftedByOther = allSquads.some(
    (s) => s.manager_id !== managerId && s.players.some((p) => p.id === playerIn.id)
  );
  if (isDraftedByOther) {
    return { valid: false, reason: "This player is already in another manager's squad." };
  }

  const newSquad = currentSquad
    .filter((p) => p.id !== playerOut.id)
    .concat(playerIn);

  const teamCounts: Record<string, number> = {};
  for (const p of newSquad) {
    teamCounts[p.team_id] = (teamCounts[p.team_id] ?? 0) + 1;
    if (teamCounts[p.team_id] > 2) {
      return {
        valid: false,
        reason: `You cannot have more than 2 players from ${p.team?.name ?? p.team_id}.`,
      };
    }
  }

  return { valid: true };
}

// ─── Draft validation ────────────────────────────────────────────────────────

export function validateDraftPick(
  playerId: string,
  managerId: string,
  allPicks: DraftPick[],
  currentManagerSquad: Player[]
): TransferValidationResult {
  const alreadyPicked = allPicks.some((pick) => pick.player_id === playerId);
  if (alreadyPicked) {
    return { valid: false, reason: "This player has already been drafted." };
  }

  if (currentManagerSquad.length >= 11) {
    return { valid: false, reason: "Your squad is already full (11 players)." };
  }

  return { valid: true };
}