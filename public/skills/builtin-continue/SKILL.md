---
id: builtin-continue
name: 续写
icon: "✍️"
description: 根据当前章节内容自然地续写下去
parameters: []
contextHints:
  - signal: isNearEnd
    condition: "true"
    weight: 1.5
  - signal: wordCount
    condition: high
    weight: 0.5
sortOrder: 0
enabled: true
---

请根据当前章节的最后几段内容，保持一致的叙事视角、文风和节奏，自然地续写下去。注意：1）延续当前的情节走向和情绪基调；2）如果有对话正在进行，继续对话并推进剧情；3）保持与已出场角色的性格一致性；4）适当穿插环境描写和心理活动；5）约400-600字。
