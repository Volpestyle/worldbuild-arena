# 3D Scene Implementation Gaps

This document tracks features specified in `docs/tech.md` that are not yet implemented in `apps/web/src/components/scene/`.

---

## 1. Speaker Close-up Camera Auto-Focus

**Spec (tech.md):**
> Camera: "Speaker Close-up" (tight) - snap-to view

**Current state:** Camera has `both`, `team_a`, `team_b` presets but no automatic tracking of the active speaker.

**How to address:**

```typescript
// In ArenaScene.tsx, add dynamic camera preset based on active speaker
const activeSpeaker = useMatchStore(selectActiveSpeaker);

useEffect(() => {
  if (activeSpeaker) {
    // Option A: Auto-switch to team view
    setCameraPreset(activeSpeaker.teamId === "A" ? "team_a" : "team_b");

    // Option B: Compute speaker position and animate camera there
    const teamOffset = activeSpeaker.teamId === "A" ? -4 : 4;
    const seatPos = SEAT_POSITIONS[ROLE_SEAT_INDEX[activeSpeaker.role]];
    // Animate camera to focus on [teamOffset + seatPos[0], seatPos[1] + 2, seatPos[2] + 3]
  }
}, [activeSpeaker]);
```

**Files to modify:**
- `apps/web/src/components/scene/ArenaScene.tsx`
- `apps/web/src/components/scene/Camera.tsx` - add `speaker` preset with dynamic target

---

## 2. Camera Nudge on Turn Start

**Spec (tech.md):**
> Turn start: speaker avatar highlights; seat lamp turns on; subtle camera nudge toward the active table.

**Current state:** Avatar highlights and seat lamp work, but no camera nudge.

**How to address:**

```typescript
// In Camera.tsx, add a subtle offset when active team changes
const [nudgeOffset, setNudgeOffset] = useState<[number, number, number]>([0, 0, 0]);

useEffect(() => {
  if (activeTeam === "A") {
    setNudgeOffset([-0.5, 0, 0]); // Nudge left
  } else if (activeTeam === "B") {
    setNudgeOffset([0.5, 0, 0]); // Nudge right
  }

  // Reset after animation
  const timeout = setTimeout(() => setNudgeOffset([0, 0, 0]), 500);
  return () => clearTimeout(timeout);
}, [activeTeam]);

// Apply nudge in useFrame
camera.position.x = THREE.MathUtils.lerp(
  camera.position.x,
  targetPosition.current.x + nudgeOffset[0],
  0.1
);
```

**Files to modify:**
- `apps/web/src/components/scene/Camera.tsx`

---

## 3. OBJECTION Red Edge Light Accent

**Spec (tech.md):**
> OBJECTION: contrarian gets a stronger accent (e.g., red edge light); a "stress-test" indicator appears.

**Current state:** Contrarian avatar has red color (`#e74c3c`) but no enhanced visual during OBJECTION turns.

**How to address:**

```typescript
// In Avatar.tsx, add turn-type-aware effects
type AvatarProps = {
  role: Role;
  teamId: TeamId;
  seatIndex: number;
  isActive: boolean;
  turnType?: TurnType; // Add this
};

// In the component:
const isObjection = isActive && turnType === "OBJECTION" && role === "CONTRARIAN";

// Add a rim light or enhanced glow
{isObjection && (
  <pointLight
    position={[0, 1.5, 0.5]}
    color="#ff3333"
    intensity={3}
    distance={2}
  />
)}

// Or use a post-processing outline effect via @react-three/postprocessing
```

**Files to modify:**
- `apps/web/src/components/scene/Avatar.tsx`
- `apps/web/src/components/scene/ArenaScene.tsx` - pass `turnType` to Avatar

---

## 4. VOTE Token Animation

**Spec (tech.md):**
> VOTE: each avatar emits a token (ACCEPT/AMEND/REJECT) into a bowl; tally resolves to a result state.

**Current state:** No vote visualization in 3D scene. Votes only shown in HUD.

**How to address:**

Create a new `VoteToken.tsx` component:

```typescript
// apps/web/src/components/scene/VoteToken.tsx
type VoteTokenProps = {
  choice: VoteChoice;
  startPosition: [number, number, number];
  targetPosition: [number, number, number]; // Bowl center
};

export function VoteToken({ choice, startPosition, targetPosition }: VoteTokenProps) {
  const ref = useRef<THREE.Mesh>(null);
  const [progress, setProgress] = useState(0);

  const color = {
    ACCEPT: "#2ecc71",
    AMEND: "#9b59b6",
    REJECT: "#e74c3c",
  }[choice];

  useFrame((_, delta) => {
    if (progress < 1) {
      setProgress(p => Math.min(p + delta * 2, 1));
      // Arc trajectory
      const t = progress;
      ref.current?.position.set(
        THREE.MathUtils.lerp(startPosition[0], targetPosition[0], t),
        startPosition[1] + Math.sin(t * Math.PI) * 1.5, // Arc
        THREE.MathUtils.lerp(startPosition[2], targetPosition[2], t)
      );
    }
  });

  return (
    <mesh ref={ref} position={startPosition}>
      <sphereGeometry args={[0.1, 8, 8]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
    </mesh>
  );
}
```

Add a `VoteBowl.tsx` component at table center, and trigger tokens when `vote_result` events occur.

**Files to create:**
- `apps/web/src/components/scene/VoteToken.tsx`
- `apps/web/src/components/scene/VoteBowl.tsx`

**Files to modify:**
- `apps/web/src/components/scene/ArenaScene.tsx` - render vote animations

---

## 5. Validation Error Stinger

**Spec (tech.md):**
> Validation/repair loop: brief "error" stinger (HUD + world), then "repair" retry animation; transcript preserves the validator error for replay/debug.

**Current state:** No visual feedback for `turn_validation_failed` events.

**How to address:**

```typescript
// In ArenaScene.tsx, listen for validation failures
const events = useMatchStore(selectVisibleEvents);
const [showError, setShowError] = useState(false);

useEffect(() => {
  const lastEvent = events[events.length - 1];
  if (lastEvent?.type === "turn_validation_failed") {
    setShowError(true);
    setTimeout(() => setShowError(false), 1000);
  }
}, [events]);

// Add a screen flash or shake effect
{showError && (
  <mesh position={[0, 5, 0]}>
    <planeGeometry args={[50, 50]} />
    <meshBasicMaterial color="#ff0000" transparent opacity={0.3} side={THREE.DoubleSide} />
  </mesh>
)}
```

For HUD, add shake animation:

```typescript
// In TeamPanel.tsx
const lastEvent = useMatchStore(s => s.events[s.events.length - 1]);
const hasError = lastEvent?.type === "turn_validation_failed" && lastEvent.team_id === teamId;

<motion.div
  animate={hasError ? { x: [0, -5, 5, -5, 5, 0] } : {}}
  transition={{ duration: 0.4 }}
>
```

**Files to modify:**
- `apps/web/src/components/scene/ArenaScene.tsx`
- `apps/web/src/components/hud/TeamPanel.tsx`

---

## 6. Prompt Engineer Station (Optional)

**Spec (tech.md):**
> optional: a neutral "Prompt Engineer" station that activates only during artifact generation

**Current state:** Not implemented.

**How to address:**

Create a separate station that appears during Phase 5:

```typescript
// apps/web/src/components/scene/PromptEngineerStation.tsx
type Props = {
  isActive: boolean; // true during phase 5
};

export function PromptEngineerStation({ isActive }: Props) {
  if (!isActive) return null;

  return (
    <group position={[0, 0, -5]}> {/* Behind the tables */}
      {/* Desk/console geometry */}
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[2, 1, 1]} />
        <meshStandardMaterial color="#3a3a4a" />
      </mesh>

      {/* Neutral avatar */}
      <mesh position={[0, 1.5, 0]}>
        <capsuleGeometry args={[0.25, 0.6, 4, 16]} />
        <meshStandardMaterial color="#888888" />
      </mesh>

      {/* Floating "GENERATING" indicator */}
      <Html position={[0, 2.5, 0]} center>
        <div style={{ color: "#ffd700", fontWeight: 700 }}>
          GENERATING ARTIFACTS...
        </div>
      </Html>
    </group>
  );
}
```

**Files to create:**
- `apps/web/src/components/scene/PromptEngineerStation.tsx`

**Files to modify:**
- `apps/web/src/components/scene/ArenaScene.tsx` - conditionally render during phase 5

---

## 7. GLTF Avatar Models

**Spec (tech.md):**
> MVP: stylized low-poly characters (cheap to animate, easy to read)
> Later: swappable GLTF rigs; role-specific idle animations

**Current state:** Using primitive geometry (capsules/spheres).

**How to address:**

1. Create or acquire GLTF models for each role
2. Place in `apps/web/public/models/`
3. Use `useGLTF` from `@react-three/drei`:

```typescript
import { useGLTF } from "@react-three/drei";

export function Avatar({ role, ... }: AvatarProps) {
  const { scene, animations } = useGLTF(`/models/avatar-${role.toLowerCase()}.glb`);
  const { actions } = useAnimations(animations, scene);

  useEffect(() => {
    if (isActive) {
      actions["speaking"]?.play();
    } else {
      actions["idle"]?.play();
    }
  }, [isActive, actions]);

  return <primitive object={scene} />;
}
```

**Files to modify:**
- `apps/web/src/components/scene/Avatar.tsx`

**Assets to create:**
- `apps/web/public/models/avatar-architect.glb`
- `apps/web/public/models/avatar-lorekeeper.glb`
- `apps/web/public/models/avatar-contrarian.glb`
- `apps/web/public/models/avatar-synthesizer.glb`

---

## Priority Order

1. **High Impact, Low Effort:**
   - Camera nudge on turn start
   - OBJECTION red accent
   - Validation error stinger

2. **Medium Impact, Medium Effort:**
   - Speaker close-up auto-focus
   - VOTE token animation

3. **Low Priority (Optional/Future):**
   - Prompt Engineer station
   - GLTF avatar models

---

## Implementation Checklist

- [ ] Speaker close-up camera auto-focus
- [ ] Camera nudge on turn start
- [ ] OBJECTION red edge light accent
- [ ] VOTE token animation into bowl
- [ ] Validation error stinger (3D + HUD)
- [ ] Prompt Engineer station (Phase 5)
- [ ] GLTF avatar model loading
