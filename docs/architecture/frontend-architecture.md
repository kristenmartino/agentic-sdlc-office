# Frontend Architecture

## Stack

TODO — decide between PixiJS / Phaser / DOM+SVG. See open Decision issue if one exists.

## Rendering model

TODO — sprites vs. DOM, layering, hit-testing for clicks.

## Module layout (draft)

```
src/
  office/        # scene, rooms, agents
  panels/        # work item, decision inbox, agent drawer
  state/         # event store, reducers
  events/        # event types, dispatchers
  assets/        # registry of art assets
```
