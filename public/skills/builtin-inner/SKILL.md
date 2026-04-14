---
id: builtin-inner
name: 内心
icon: "💭"
description: 为角色写一段深入的内心独白
parameters:
  - key: character
    label: 角色
    type: select
    source: characters
    placeholder: 选择角色（可选）
    required: false
contextHints:
  - signal: hasCharacters
    condition: "true"
    weight: 1.5
sortOrder: 7
enabled: true
---

请为当前场景中的{param:character}写一段深入的内心独白。要求：1）展现角色此刻的真实想法和情感波动；2）通过内心活动揭示角色的动机、恐惧或欲望；3）可以穿插回忆片段或联想；4）内心独白的语言风格要符合角色的教育背景和性格特点；5）与外在表现形成对比或呼应，增加角色的层次感。约200-400字。
