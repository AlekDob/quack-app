// Adapted from Functionary (MIT), Copyright (c) 2026 Nemanja Stojanovic.

import { Line, MapControls, Text } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { configureTextBuilder } from "troika-three-text";

import {
  computeFunctionaryChildPositions,
  computeFunctionaryFlowLayout,
  functionaryChildPlaqueWidth,
  projectFunctionaryEdges,
  type FunctionaryFlowLayout,
} from "~/lib/functionaryFlowLayout";
import { type FunctionaryEdge, type FunctionaryNode } from "~/lib/functionaryMap";

configureTextBuilder({ useWorker: false });

const INK = "#14202b";
const PAPER = "#dbe5e7";
const PANEL = "#edf3f2";
const DISTRICT_COLORS = ["#c8dfe2", "#cddbcf", "#d7d2e5", "#e2cfd7", "#c9d7e6"];
const EVIDENCE_COLORS: Record<FunctionaryEdge["evidence"], string> = {
  declared: INK,
  observed: "#3f725d",
  inferred: "#a56f46",
};

function CameraRig({
  bounds,
  viewKey,
}: {
  bounds: FunctionaryFlowLayout["bounds"];
  viewKey: string;
}) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as {
    target?: THREE.Vector3;
    update?: () => void;
  } | null;
  const viewport = useThree((state) => state.size);

  useEffect(() => {
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerZ = (bounds.minZ + bounds.maxZ) / 2;
    const spanX = Math.max(4, bounds.maxX - bounds.minX);
    const spanZ = Math.max(4, bounds.maxZ - bounds.minZ);
    const target = new THREE.Vector3(centerX, 0.35, centerZ);
    camera.position.set(centerX + 11, 14, centerZ + 15);
    camera.lookAt(target);
    controls?.target?.copy(target);
    controls?.update?.();
    if (camera instanceof THREE.OrthographicCamera) {
      camera.zoom = Math.max(
        11,
        Math.min(70, Math.min(viewport.width / (spanX + 7), viewport.height / (spanZ + 7)) * 0.9),
      );
      camera.updateProjectionMatrix();
    }
  }, [bounds, camera, controls, viewKey, viewport.height, viewport.width]);

  return null;
}

function NeighborhoodPlots({
  layout,
  levelLabel,
  selectedId,
}: {
  layout: FunctionaryFlowLayout;
  levelLabel?: string | null;
  selectedId: string | null;
}) {
  return layout.neighborhoods.map((neighborhood, index) => {
    const { minX, maxX, minZ, maxZ } = neighborhood.bounds;
    const width = maxX - minX;
    const depth = maxZ - minZ;
    const active = selectedId ? neighborhood.nodeIds.includes(selectedId) : false;
    const outline: [number, number, number][] = [
      [minX, 0.004, minZ],
      [maxX, 0.004, minZ],
      [maxX, 0.004, maxZ],
      [minX, 0.004, maxZ],
      [minX, 0.004, minZ],
    ];
    const signWidth = Math.min(width - 0.6, 5.2);

    return (
      <group key={neighborhood.id}>
        <mesh
          position={[(minX + maxX) / 2, -0.027, (minZ + maxZ) / 2]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[width, depth]} />
          <meshBasicMaterial
            color={DISTRICT_COLORS[index % DISTRICT_COLORS.length]}
            depthWrite={false}
            transparent
            opacity={active ? 0.52 : 0.34}
          />
        </mesh>
        <Line points={outline} color={active ? INK : "#70878c"} lineWidth={active ? 1.5 : 0.9} />
        <group position={[(minX + maxX) / 2, 0.05, maxZ - 0.55]} rotation={[-Math.PI / 2, 0, 0]}>
          <mesh>
            <planeGeometry args={[signWidth, 0.78]} />
            <meshBasicMaterial color={active ? INK : PANEL} />
          </mesh>
          <Text
            position={[-signWidth / 2 + 0.18, 0, 0.014]}
            color={active ? PANEL : INK}
            fontSize={0.25}
            maxWidth={signWidth - 0.36}
            anchorX="left"
            anchorY="middle"
          >
            {`N${index + 1}  ${neighborhood.id === "__system" && levelLabel ? levelLabel : neighborhood.label}`}
          </Text>
        </group>
      </group>
    );
  });
}

function Connections({
  edges,
  positions,
  selectedId,
}: {
  edges: readonly FunctionaryEdge[];
  positions: Map<string, [number, number]>;
  selectedId: string | null;
}) {
  return edges.map((edge) => {
    const from = positions.get(edge.from);
    const to = positions.get(edge.to);
    if (!from || !to) return null;
    const active = selectedId === edge.from || selectedId === edge.to;
    const middleZ = from[1] + (to[1] - from[1]) * 0.52;
    const points: [number, number, number][] = [
      [from[0], 0.045, from[1]],
      [from[0], 0.045, middleZ],
      [to[0], 0.045, middleZ],
      [to[0], 0.045, to[1]],
    ];

    return (
      <Line
        key={edge.id}
        points={points}
        color={EVIDENCE_COLORS[edge.evidence]}
        lineWidth={active ? 2 : 0.7}
        dashed={edge.evidence === "inferred"}
        dashSize={0.17}
        gapSize={0.1}
        transparent
        opacity={active ? 0.9 : 0.2}
      />
    );
  });
}

function geometryFor(node: FunctionaryNode, width: number, height: number, depth: number) {
  if (node.archetype === "database") {
    return new THREE.CylinderGeometry(width / 2, width / 2, height, 24);
  }
  if (node.archetype === "cloud") return new THREE.DodecahedronGeometry(width * 0.55, 0);
  return new THREE.BoxGeometry(width, height, depth);
}

function Structure({
  node,
  index,
  position,
  roomCount,
  dimmed,
  onHoverEnd,
  onHoverStart,
  onPeekEnd,
  onPeekStart,
  selected,
  onSelect,
}: {
  node: FunctionaryNode;
  index: number;
  position: [number, number];
  roomCount: number;
  dimmed?: boolean;
  onHoverEnd: () => void;
  onHoverStart: () => void;
  onPeekEnd?: () => void;
  onPeekStart?: () => void;
  selected: boolean;
  onSelect: () => void;
}) {
  const requested = node.display?.size ?? [1.75, 1.2, 1.5];
  const width = requested[0];
  const height = roomCount > 0 ? Math.min(3.8, 1.3 + roomCount * 0.45) : requested[1];
  const depth = requested[2];
  const geometry = useMemo(
    () => geometryFor(node, width, height, depth),
    [depth, height, node, width],
  );
  const outline = useMemo(() => new THREE.EdgesGeometry(geometry), [geometry]);
  const color =
    node.display?.color ??
    (node.kind === "infra" ? "#b17f9f" : node.kind === "external" ? "#cf8278" : "#81afa6");
  const labelLength = node.label.length + (roomCount ? 3 : 0);
  const plaqueWidth = Math.max(2.7, Math.min(4.7, 2 + labelLength * 0.065));
  const plaqueHeight = roomCount ? 1.02 : 0.86;
  const plaqueZ = position[1] + depth / 2 + plaqueHeight / 2 + 0.22;

  return (
    <group
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      onPointerEnter={() => {
        document.body.style.cursor = "pointer";
        onHoverStart();
        onPeekStart?.();
      }}
      onPointerLeave={() => {
        document.body.style.cursor = "default";
        onHoverEnd();
        onPeekEnd?.();
      }}
    >
      {selected ? (
        <mesh position={[position[0], 0.012, position[1]]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[width + 0.42, depth + 0.42]} />
          <meshBasicMaterial color={INK} transparent opacity={0.16} depthWrite={false} />
        </mesh>
      ) : null}
      <mesh
        geometry={geometry}
        position={[position[0], height / 2, position[1]]}
        castShadow={!dimmed}
        receiveShadow
      >
        <meshStandardMaterial
          color={color}
          emissive={selected ? color : "#000000"}
          emissiveIntensity={selected ? 0.3 : 0}
          roughness={0.84}
          transparent
          depthWrite={!dimmed}
          opacity={dimmed ? 0.12 : node.kind === "external" ? 0.82 : 1}
        />
      </mesh>
      <lineSegments
        geometry={outline}
        position={[position[0], height / 2, position[1]]}
        scale={selected ? 1.05 : 1.006}
      >
        <lineBasicMaterial
          color={INK}
          transparent
          depthWrite={!dimmed}
          opacity={dimmed ? 0.12 : 1}
        />
      </lineSegments>
      {Array.from({ length: Math.max(0, Math.min(4, roomCount - 1)) }, (_, floor) => (
        <mesh
          key={floor}
          position={[
            position[0],
            ((floor + 1) * height) / Math.max(2, roomCount),
            position[1] + depth / 2 + 0.01,
          ]}
        >
          <planeGeometry args={[width * 0.86, 0.025]} />
          <meshBasicMaterial
            color={INK}
            transparent
            depthWrite={!dimmed}
            opacity={dimmed ? 0.08 : 0.6}
          />
        </mesh>
      ))}
      <group position={[position[0], 0.06, plaqueZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <mesh>
          <planeGeometry args={[plaqueWidth, plaqueHeight]} />
          <meshBasicMaterial
            color={selected ? INK : node.kind === "external" ? "#f0e5e5" : "#e5efee"}
            transparent
            depthWrite={!dimmed}
            opacity={dimmed ? 0.12 : 1}
          />
        </mesh>
        <Text
          position={[-plaqueWidth / 2 + 0.18, 0, 0.014]}
          color={selected ? PANEL : INK}
          fontSize={roomCount ? 0.28 : 0.23}
          maxWidth={plaqueWidth - 0.36}
          anchorX="left"
          anchorY="middle"
          fillOpacity={dimmed ? 0.12 : 1}
        >
          {`${String(index + 1).padStart(2, "0")}  ${node.label}${roomCount ? "  ↘" : ""}`}
        </Text>
      </group>
    </group>
  );
}

function SubStructure({
  node,
  index,
  position,
  hasChildren,
  selected,
  onHoverEnd,
  onHoverStart,
  onPeekEnd,
  onPeekStart,
  onSelect,
  onEnter,
}: {
  node: FunctionaryNode;
  index: number;
  position: [number, number];
  hasChildren: boolean;
  selected: boolean;
  onHoverEnd: () => void;
  onHoverStart: () => void;
  onPeekEnd: () => void;
  onPeekStart: () => void;
  onSelect: () => void;
  onEnter: () => void;
}) {
  const width = 1.35;
  const height = hasChildren ? 0.9 : 0.58;
  const depth = 1.1;
  const geometry = useMemo(() => new THREE.BoxGeometry(width, height, depth), []);
  const outline = useMemo(() => new THREE.EdgesGeometry(geometry), [geometry]);
  const plaqueWidth = functionaryChildPlaqueWidth(node.label);
  const plaqueHeight = node.label.length > 22 ? 0.88 : 0.68;
  const plaqueZ = position[1] + depth / 2 + plaqueHeight / 2 + 0.2;

  return (
    <group
      onClick={(event) => {
        event.stopPropagation();
        if (hasChildren) onEnter();
        else onSelect();
      }}
      onPointerEnter={() => {
        document.body.style.cursor = "pointer";
        onHoverStart();
        onPeekStart();
      }}
      onPointerLeave={() => {
        document.body.style.cursor = "default";
        onHoverEnd();
        onPeekEnd();
      }}
    >
      <mesh
        geometry={geometry}
        position={[position[0], height / 2, position[1]]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color={node.display?.color ?? (hasChildren ? "#9b87b4" : "#d2a36c")}
          emissive={
            selected
              ? (node.display?.color ?? (hasChildren ? "#9b87b4" : "#d2a36c"))
              : "#000000"
          }
          emissiveIntensity={selected ? 0.35 : 0}
          roughness={0.86}
        />
      </mesh>
      <lineSegments
        geometry={outline}
        position={[position[0], height / 2, position[1]]}
        scale={selected ? 1.05 : 1.006}
      >
        <lineBasicMaterial color={INK} />
      </lineSegments>
      <group position={[position[0], 0.06, plaqueZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <mesh>
          <planeGeometry args={[plaqueWidth, plaqueHeight]} />
          <meshBasicMaterial color={selected ? INK : "#f3eadc"} />
        </mesh>
        <Text
          position={[0, 0, 0.014]}
          color={selected ? PANEL : INK}
          fontSize={node.label.length > 22 ? 0.16 : 0.18}
          maxWidth={plaqueWidth - 0.28}
          lineHeight={1.05}
          textAlign="center"
          anchorX="center"
          anchorY="middle"
        >
          {`${String(index + 1).padStart(2, "0")}  ${node.label}${hasChildren ? "  ↘" : ""}`}
        </Text>
      </group>
    </group>
  );
}

function ExpandedChildren({
  allNodes,
  edges,
  layout,
  parentId,
  selectedId,
  onHoverEnd,
  onHoverStart,
  onPeekEnd,
  onPeekStart,
  onSelect,
  onEnter,
}: {
  allNodes: readonly FunctionaryNode[];
  edges: readonly FunctionaryEdge[];
  layout: FunctionaryFlowLayout;
  parentId: string;
  selectedId: string | null;
  onHoverEnd: () => void;
  onHoverStart: (nodeId: string) => void;
  onPeekEnd: () => void;
  onPeekStart: () => void;
  onSelect: (nodeId: string) => void;
  onEnter: (nodeId: string) => void;
}) {
  const parentPosition = layout.positions.get(parentId);
  const children = allNodes.filter((node) => node.parentId === parentId);
  if (!parentPosition || children.length === 0) return null;

  const positions = computeFunctionaryChildPositions(children, parentPosition);
  const childIds = new Set(children.map((node) => node.id));
  const childEdges = edges.filter((edge) => childIds.has(edge.from) && childIds.has(edge.to));

  return (
    <group>
      <Connections edges={childEdges} positions={positions} selectedId={selectedId} />
      {children.map((node, index) => (
        <SubStructure
          key={node.id}
          node={node}
          index={index}
          position={positions.get(node.id)!}
          hasChildren={allNodes.some((candidate) => candidate.parentId === node.id)}
          selected={node.id === selectedId}
          onHoverEnd={onHoverEnd}
          onHoverStart={() => onHoverStart(node.id)}
          onPeekEnd={onPeekEnd}
          onPeekStart={onPeekStart}
          onSelect={() => onSelect(node.id)}
          onEnter={() => onEnter(node.id)}
        />
      ))}
    </group>
  );
}

export function FunctionaryCityScene({
  allNodes,
  edges,
  expandedId,
  levelLabel,
  nodes,
  selectedId,
  onEnter,
  onHoverChange,
  onSelect,
}: {
  allNodes: readonly FunctionaryNode[];
  edges: readonly FunctionaryEdge[];
  expandedId: string | null;
  levelLabel?: string | null;
  nodes: readonly FunctionaryNode[];
  selectedId: string | null;
  onEnter: (nodeId: string) => void;
  onHoverChange?: (nodeId: string | null) => void;
  onSelect: (nodeId: string) => void;
}) {
  const [peekParentId, setPeekParentId] = useState<string | null>(null);
  const peekExitTimer = useRef<number | null>(null);
  const layout = useMemo(() => computeFunctionaryFlowLayout(nodes, allNodes), [allNodes, nodes]);
  const visibleEdges = useMemo(
    () => projectFunctionaryEdges(nodes, edges, allNodes),
    [allNodes, edges, nodes],
  );
  const beginPeek = useCallback((parentId: string) => {
    if (peekExitTimer.current !== null) window.clearTimeout(peekExitTimer.current);
    peekExitTimer.current = null;
    setPeekParentId(parentId);
  }, []);
  const endPeek = useCallback(() => {
    if (peekExitTimer.current !== null) window.clearTimeout(peekExitTimer.current);
    peekExitTimer.current = window.setTimeout(() => {
      setPeekParentId(null);
      peekExitTimer.current = null;
    }, 650);
  }, []);
  const beginHover = useCallback(
    (nodeId: string) => {
      onHoverChange?.(nodeId);
    },
    [onHoverChange],
  );
  const endHover = useCallback(() => {
    onHoverChange?.(null);
  }, [onHoverChange]);

  useEffect(() => {
    if (!expandedId) setPeekParentId(null);
  }, [expandedId]);

  useEffect(
    () => () => {
      if (peekExitTimer.current !== null) window.clearTimeout(peekExitTimer.current);
    },
    [],
  );

  return (
    <Canvas
      orthographic
      camera={{ position: [10, 13, 15], zoom: 48, near: 0.1, far: 160 }}
      dpr={[1, 1.7]}
      shadows
    >
      <CameraRig bounds={layout.bounds} viewKey={nodes.map((node) => node.id).join(":")} />
      <color attach="background" args={[PAPER]} />
      <ambientLight intensity={1.6} />
      <directionalLight
        position={[-6, 12, 7]}
        intensity={2.25}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <gridHelper args={[80, 80, "#91a7ab", "#c1d0d2"]} position={[0, -0.035, 0]} />
      <NeighborhoodPlots layout={layout} levelLabel={levelLabel} selectedId={selectedId} />
      <Connections edges={visibleEdges} positions={layout.positions} selectedId={selectedId} />
      {nodes.map((node, index) => (
        <Structure
          key={node.id}
          node={node}
          index={index}
          position={layout.positions.get(node.id)!}
          roomCount={allNodes.filter((candidate) => candidate.parentId === node.id).length}
          dimmed={peekParentId !== null && node.id !== peekParentId}
          onHoverEnd={endHover}
          onHoverStart={() => beginHover(node.id)}
          onPeekEnd={expandedId === node.id ? endPeek : undefined}
          onPeekStart={expandedId === node.id ? () => beginPeek(node.id) : undefined}
          selected={node.id === selectedId}
          onSelect={() => onSelect(node.id)}
        />
      ))}
      {expandedId ? (
        <ExpandedChildren
          allNodes={allNodes}
          edges={edges}
          layout={layout}
          parentId={expandedId}
          selectedId={selectedId}
          onHoverEnd={endHover}
          onHoverStart={beginHover}
          onPeekEnd={endPeek}
          onPeekStart={() => beginPeek(expandedId)}
          onSelect={onSelect}
          onEnter={onEnter}
        />
      ) : null}
      <MapControls
        makeDefault
        enableRotate={false}
        enableDamping
        dampingFactor={0.08}
        minZoom={10}
        maxZoom={110}
        screenSpacePanning
      />
    </Canvas>
  );
}
