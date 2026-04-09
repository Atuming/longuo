/** 角色 */
export interface Character {
  id: string;
  projectId: string;
  name: string;
  aliases: string[];
  appearance: string;
  personality: string;
  backstory: string;
  customAttributes: Record<string, string>;
}

/** 角色时间快照 */
export interface CharacterTimelineSnapshot {
  id: string;
  characterId: string;
  timelinePointId: string;
  appearance: string;
  personality: string;
  backstoryEvents: string[];
  customAttributes: Record<string, string>;
}
