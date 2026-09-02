---
type: terminology
status: active
research_version: 1.0.0
---

# 📖 Controlled Terminology: AutoTrace & Diagram Routing

## 1. Orthogonal Routing (Ортогональная трассировка)
* **Canonical term:** Orthogonal Routing
* **Aliases:** Manhattan routing, rectilinear routing, grid routing.
* **Definition:** Прокладка геометрических трасс между портами блоков, состоящих исключительно из взаимно перпендикулярных горизонтальных ($dx \neq 0, dy = 0$) и вертикальных ($dx = 0, dy \neq 0$) прямолинейных отрезков.

## 2. Port Outflow Normal (Нормаль вылета порта)
* **Canonical term:** Port Outflow Normal
* **Definition:** Единичный вектор $\vec{n} = (dx, dy)$, направленный строго наружу из грани блока. 
* **Invariant:** Первый отрезок трассы, выходящий из порта, обязан быть коллинеарен $\vec{n}$ на длину не менее $L_{stub}$ (минимум 12–24 px).

## 3. Collinear Wire Overlap (Паразитное коллинеарное наложение)
* **Canonical term:** Collinear Wire Overlap
* **Definition:** Ситуация, когда два не связанных логически провода имеют совпадающие параллельные геометрические сегменты ненулевой длины ($L_{overlap} > 0$).
* **Standard:** В качественной схемотехнике $L_{overlap} \equiv 0$. Допускаются только строго перпендикулярные (90°) точечные пересечения.

## 4. Bridge Jump (Прыжковый мостик)
* **Canonical term:** Bridge Jump / Crossover Arc
* **Definition:** Дуговой полукруглый сегмент радиуса $R \approx 4\dots 6\text{ px}$, визуально перешагивающий пересекаемый перпендикулярный провод, исключая путаницу пересечения с электрическим узлом.

## 5. G1 Continuous Fillet (G1-скругление углов)
* **Canonical term:** G1 Tangent Continuous Corner Fillet
* **Definition:** Плавное сопряжение ортогональных отрезков по касательной (равенство первых производных), обеспечивающее эстетичный вид в презентационных диаграммах без нарушения прямолинейности основных магистралей.

## 6. ScenePatch (Инкрементальный дифференциальный патч)
* **Canonical term:** ScenePatch
* **Definition:** Структура данных, содержащая `baseRevision`, `changedBlocks`, `changedEdges`, `removedBlockIds`, `removedEdgeIds`. Позволяет перетрассировать только локально поврежденные связности.
