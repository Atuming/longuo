---
id: builtin-dialogue
name: 对话
icon: "💬"
description: 生成符合角色性格的高质量对话
parameters:
  - key: character1
    label: 角色A
    type: select
    source: characters
    placeholder: 选择角色（可选）
    required: false
  - key: character2
    label: 角色B
    type: select
    source: characters
    placeholder: 选择角色（可选）
    required: false
contextHints:
  - signal: hasCharacters
    condition: "true"
    weight: 1.5
  - signal: hasDialogue
    condition: "true"
    weight: 0.5
sortOrder: 2
enabled: true
---

请根据当前场景和在场角色，生成一段高质量的角色对话。{param:character1}{param:character2}要求：1）每个角色的语气、用词、说话习惯要符合其性格设定；2）对话要推动剧情发展或揭示角色关系；3）穿插适当的动作描写、表情描写和心理活动（不要纯对话）；4）对话节奏有张有弛，避免一问一答的机械感；5）如有冲突或悬念，通过对话自然展现。约300-500字。
