/** 角色关系 */
export interface CharacterRelationship {
  id: string;
  projectId: string;
  sourceCharacterId: string;
  targetCharacterId: string;
  relationshipType: 'family' | 'friend' | 'enemy' | 'mentor' | 'lover' | 'ally' | 'superior' | 'custom';
  customTypeName?: string;
  description: string;
  startTimelinePointId: string;
  endTimelinePointId?: string;
  strength: number;
}
