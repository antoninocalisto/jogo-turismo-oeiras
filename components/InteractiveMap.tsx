import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { touristicPoints, TouristicPoint } from '@/data/touristicPoints';

interface PlayerPosition {
  lat: number;
  lng: number;
}

interface InteractiveMapProps {
  onPointVisited?: (point: TouristicPoint) => void;
  onBadgeUnlocked?: (badgeId: string) => void;
}

const INITIAL_PLAYER_POSITION: PlayerPosition = {
  lat: -7.0174049,
  lng: -42.1311325,
};
const INTERACTION_DISTANCE_METERS = 35;
const MISSION_ZONE_VISIBLE_METERS = 85;
const MISSION_COMPLETE_METERS = 18;
const MISSION_ZONE_FIELD_OF_VIEW_DEGREES = 74;
const PREFETCH_FRAME_COUNT = 10;
const MAPILLARY_SEARCH_RADIUS_DEGREES = 0.025;
const TURN_STEP_DEGREES = 10;
const MOVE_SUBSTEPS = 3;
const MINI_MAP_SIZE = 224;
const MINI_MAP_PADDING = 22;
const MINI_MAP_WORLD_RADIUS_METERS = 180;
const VIRTUAL_CLICK_FORWARD_OFFSET_DEGREES = 8;

const distanceInMeters = (start: PlayerPosition, point: [number, number]) => {
  const earthRadius = 6371000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLat = toRadians(point[0] - start.lat);
  const deltaLng = toRadians(point[1] - start.lng);
  const lat1 = toRadians(start.lat);
  const lat2 = toRadians(point[0]);
  const calculation =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

  return 2 * earthRadius * Math.atan2(Math.sqrt(calculation), Math.sqrt(1 - calculation));
};

const bearingToPoint = (start: PlayerPosition, point: [number, number]) => {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const toDegrees = (radians: number) => (radians * 180) / Math.PI;
  const lat1 = toRadians(start.lat);
  const lat2 = toRadians(point[0]);
  const deltaLng = toRadians(point[1] - start.lng);
  const y = Math.sin(deltaLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);

  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
};

const headingDifference = (first: number, second: number) =>
  Math.abs(((first - second + 540) % 360) - 180);

const signedHeadingDifference = (first: number, second: number) =>
  ((first - second + 540) % 360) - 180;

const getStreetLinks = (links?: (google.maps.StreetViewLink | null)[] | null) =>
  (links ?? []).filter(
    (link): link is google.maps.StreetViewLink & { pano: string; heading: number } =>
      Boolean(link?.pano) && typeof link?.heading === 'number'
  );

const getClosestStreetLink = (
  links: (google.maps.StreetViewLink & { pano: string; heading: number })[],
  desiredHeading: number
) =>
  links.reduce((best, candidate) =>
    headingDifference(candidate.heading, desiredHeading) <
    headingDifference(best.heading, desiredHeading)
      ? candidate
      : best
  );

const getPreferredStreetLink = (
  links: (google.maps.StreetViewLink & { pano: string; heading: number })[],
  desiredHeading: number,
  steeringBias = 0
) =>
  links.reduce((best, candidate) => {
    const scoreLink = (link: google.maps.StreetViewLink & { pano: string; heading: number }) => {
      const signedDelta = signedHeadingDifference(link.heading, desiredHeading);
      const sameSideBonus =
        steeringBias !== 0 && Math.sign(signedDelta) === Math.sign(steeringBias)
          ? Math.min(Math.abs(steeringBias), 1) * 18
          : 0;
      const oppositeSidePenalty =
        steeringBias !== 0 && Math.sign(signedDelta) === -Math.sign(steeringBias)
          ? Math.min(Math.abs(steeringBias), 1) * 10
          : 0;

      return Math.abs(signedDelta) - sameSideBonus + oppositeSidePenalty;
    };

    return scoreLink(candidate) < scoreLink(best) ? candidate : best;
  });

const getVirtualClickHeading = (heading: number, steeringBias: number) =>
  heading +
  Math.max(-1, Math.min(1, steeringBias)) * VIRTUAL_CLICK_FORWARD_OFFSET_DEGREES;

const projectToCenteredMiniMap = (
  position: PlayerPosition | [number, number],
  center: PlayerPosition
) => {
  const lat = Array.isArray(position) ? position[0] : position.lat;
  const lng = Array.isArray(position) ? position[1] : position.lng;
  const metersPerLatDegree = 111320;
  const metersPerLngDegree = 111320 * Math.cos((center.lat * Math.PI) / 180);
  const deltaX = (lng - center.lng) * metersPerLngDegree;
  const deltaY = (lat - center.lat) * metersPerLatDegree;
  const pixelsPerMeter = (MINI_MAP_SIZE / 2 - MINI_MAP_PADDING) / MINI_MAP_WORLD_RADIUS_METERS;

  return {
    left: MINI_MAP_SIZE / 2 + deltaX * pixelsPerMeter,
    top: MINI_MAP_SIZE / 2 - deltaY * pixelsPerMeter,
  };
};

type ViewProvider = 'loading' | 'google' | 'mapillary';

interface MapillaryFrame {
  id: string;
  imageUrl: string;
  sequence?: string;
  lat: number;
  lng: number;
  heading: number;
  creator?: string;
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  onPointVisited,
  onBadgeUnlocked,
}) => {
  const panoramaContainerRef = useRef<any>(null);
  const panoramaRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const streetViewServiceRef = useRef<google.maps.StreetViewService | null>(null);
  const panoramaCacheRef = useRef<Map<string, google.maps.StreetViewPanoramaData>>(new Map());
  const panoramaRequestsRef = useRef<Map<string, Promise<google.maps.StreetViewPanoramaData | null>>>(
    new Map()
  );
  const moveSubstepRef = useRef({ direction: 0, count: 0 });
  const steeringBiasRef = useRef(0);
  const pendingMoveRef = useRef(false);
  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const musicAudioRef = useRef<HTMLAudioElement | null>(null);
  const musicContextRef = useRef<AudioContext | null>(null);
  const walkAnimation = useRef(new Animated.Value(0)).current;
  const motionOpacity = useRef(new Animated.Value(0)).current;
  const motionScale = useRef(new Animated.Value(1)).current;
  const sceneScale = useRef(new Animated.Value(1)).current;
  const sceneShift = useRef(new Animated.Value(0)).current;
  const aiBlend = useRef(new Animated.Value(0)).current;
  const [streetViewReady, setStreetViewReady] = useState(false);
  const [streetViewError, setStreetViewError] = useState<string | null>(null);
  const [viewProvider, setViewProvider] = useState<ViewProvider>('loading');
  const [mapillaryFrames, setMapillaryFrames] = useState<MapillaryFrame[]>([]);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [previousFrameUrl, setPreviousFrameUrl] = useState<string | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const [movementHint, setMovementHint] = useState<string | null>(null);
  const [playerPosition, setPlayerPosition] = useState<PlayerPosition>(INITIAL_PLAYER_POSITION);
  const [hasWalked, setHasWalked] = useState(false);
  const [visitedPoints, setVisitedPoints] = useState<Set<string>>(new Set());
  const [selectedPoint, setSelectedPoint] = useState<TouristicPoint | null>(null);
  const [nearbyPoints, setNearbyPoints] = useState<Set<string>>(new Set());
  const [score, setScore] = useState(0);
  const [playerHeading, setPlayerHeading] = useState(0);
  const [musicEnabled, setMusicEnabled] = useState(false);

  const activeMapillaryFrame = mapillaryFrames[currentFrameIndex];
  const currentMissionPoint =
    touristicPoints.find((point) => !visitedPoints.has(point.id)) ?? touristicPoints[0];
  const missionDistance = currentMissionPoint
    ? Math.round(distanceInMeters(playerPosition, currentMissionPoint.coordinates))
    : 0;
  const isMissionZoneVisible =
    Boolean(currentMissionPoint) && missionDistance <= MISSION_ZONE_VISIBLE_METERS;
  const missionZoneScale = currentMissionPoint
    ? Math.max(0.72, Math.min(1.18, missionDistance / MISSION_ZONE_VISIBLE_METERS + 0.45))
    : 1;
  const missionArrowRotation = currentMissionPoint
    ? signedHeadingDifference(bearingToPoint(playerPosition, currentMissionPoint.coordinates), playerHeading)
    : 0;
  const missionZoneHorizontalPercent =
    50 + (missionArrowRotation / MISSION_ZONE_FIELD_OF_VIEW_DEGREES) * 46;
  const missionZoneVerticalPercent = Math.max(
    50,
    Math.min(75, 72 - (MISSION_ZONE_VISIBLE_METERS - missionDistance) * 0.18)
  );
  const isMissionZoneOnScreen =
    isMissionZoneVisible && Math.abs(missionArrowRotation) <= MISSION_ZONE_FIELD_OF_VIEW_DEGREES;
  const playerMiniMapPosition = { left: MINI_MAP_SIZE / 2, top: MINI_MAP_SIZE / 2 };
  const miniMapRoutePoints = [INITIAL_PLAYER_POSITION, ...touristicPoints.map((point) => point.coordinates)]
    .map((position) => projectToCenteredMiniMap(position, playerPosition))
    .sort((first, second) => first.left - second.left);
  const miniMapRoadSegments = miniMapRoutePoints.slice(0, -1).map((start, index) => {
    const end = miniMapRoutePoints[index + 1];
    const deltaX = end.left - start.left;
    const deltaY = end.top - start.top;

    return {
      key: `${index}-${Math.round(start.left)}-${Math.round(end.left)}`,
      left: start.left,
      top: start.top,
      width: Math.sqrt(deltaX ** 2 + deltaY ** 2),
      angle: `${Math.atan2(deltaY, deltaX)}rad`,
    };
  });

  const stopMissionMusic = useCallback(() => {
    musicAudioRef.current?.pause();
    setMusicEnabled(false);
  }, []);

  const startMissionMusic = useCallback(() => {
    if (typeof Audio === 'undefined') {
      return;
    }

    if (!musicAudioRef.current) {
      const audio = new Audio('/audio/theme-from-san-andreas.mp3');
      audio.loop = true;
      audio.volume = 0.75;
      musicAudioRef.current = audio;
    }

    musicAudioRef.current.volume = 0.75;
    void musicAudioRef.current
      .play()
      .then(() => setMusicEnabled(true))
      .catch(() => setMusicEnabled(false));
  }, []);

  const toggleMissionMusic = useCallback(() => {
    if (musicEnabled) {
      stopMissionMusic();
      return;
    }

    startMissionMusic();
  }, [musicEnabled, startMissionMusic, stopMissionMusic]);

  const playStepSound = useCallback(() => {
    if (typeof window === 'undefined' || !window.AudioContext) {
      return;
    }

    const context = musicContextRef.current ?? new window.AudioContext();
    if (!musicContextRef.current) {
      musicContextRef.current = context;
    }

    void context.resume();
    const start = context.currentTime + 0.01;
    const playFoot = (delay: number, frequency: number) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(frequency, start + delay);
      gain.gain.setValueAtTime(0.0001, start + delay);
      gain.gain.linearRampToValueAtTime(0.18, start + delay + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, start + delay + 0.075);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start + delay);
      oscillator.stop(start + delay + 0.09);
    };

    playFoot(0, 95);
    playFoot(0.16, 78);
  }, []);

  const animateWalk = useCallback(() => {
    walkAnimation.setValue(0);
    Animated.sequence([
      Animated.timing(walkAnimation, {
        toValue: 1,
        duration: 180,
        useNativeDriver: false,
      }),
      Animated.timing(walkAnimation, {
        toValue: 0,
        duration: 180,
        useNativeDriver: false,
      }),
    ]).start();
  }, [walkAnimation]);

  const loadPanoramaData = useCallback(async (pano: string) => {
    const cached = panoramaCacheRef.current.get(pano);
    if (cached) {
      return cached;
    }

    const existingRequest = panoramaRequestsRef.current.get(pano);
    if (existingRequest) {
      return existingRequest;
    }

    const service = streetViewServiceRef.current;
    if (!service) {
      return null;
    }

    const request = service
      .getPanorama({ pano })
      .then((response) => {
        panoramaCacheRef.current.set(pano, response.data);
        return response.data;
      })
      .catch(() => null)
      .finally(() => {
        panoramaRequestsRef.current.delete(pano);
      });

    panoramaRequestsRef.current.set(pano, request);
    return request;
  }, []);

  const prefetchRouteAhead = useCallback(
    async (startPano: string, desiredHeading: number, depth = PREFETCH_FRAME_COUNT) => {
      let nextPano = startPano;
      let nextHeading = desiredHeading;

      for (let step = 0; step < depth; step += 1) {
        const data = await loadPanoramaData(nextPano);
        const links = getStreetLinks(data?.links);

        if (!links.length) {
          return;
        }

        const route = getClosestStreetLink(links, nextHeading);
        if (panoramaCacheRef.current.has(route.pano)) {
          nextPano = route.pano;
          nextHeading = route.heading;
          continue;
        }

        await loadPanoramaData(route.pano);
        nextPano = route.pano;
        nextHeading = route.heading;
      }
    },
    [loadPanoramaData]
  );

  const prefetchPanoramaNeighborhood = useCallback(
    async (originPano: string, desiredHeading: number, frameCount = PREFETCH_FRAME_COUNT) => {
      const visited = new Set<string>([originPano]);
      const queue: { pano: string; heading: number }[] = [{ pano: originPano, heading: desiredHeading }];
      let prefetchedFrames = 0;

      while (queue.length && prefetchedFrames < frameCount) {
        const current = queue.shift();
        if (!current) {
          return;
        }

        const data = await loadPanoramaData(current.pano);
        const links = getStreetLinks(data?.links).sort(
          (first, second) =>
            headingDifference(first.heading, current.heading) -
            headingDifference(second.heading, current.heading)
        );

        for (const link of links) {
          if (visited.has(link.pano) || prefetchedFrames >= frameCount) {
            continue;
          }

          visited.add(link.pano);
          prefetchedFrames += 1;
          queue.push({ pano: link.pano, heading: link.heading });
          void loadPanoramaData(link.pano);
        }
      }
    },
    [loadPanoramaData]
  );

  const prefetchVisibleRoutes = useCallback(() => {
    const panorama = panoramaRef.current;
    if (!panorama) {
      return;
    }

    const links = getStreetLinks(panorama.getLinks());
    const heading = panorama.getPov().heading;
    const currentPano = panorama.getPano();

    links.forEach((link) => {
      void loadPanoramaData(link.pano);
    });

    if (currentPano) {
      void prefetchPanoramaNeighborhood(currentPano, heading);
    }

    if (links.length) {
      const virtualClickHeading = getVirtualClickHeading(heading, steeringBiasRef.current);
      const forwardRoute = getPreferredStreetLink(
        links,
        virtualClickHeading,
        steeringBiasRef.current
      );
      const backwardRoute = getClosestStreetLink(links, heading + 180);
      void prefetchRouteAhead(forwardRoute.pano, forwardRoute.heading, PREFETCH_FRAME_COUNT);
      void prefetchRouteAhead(backwardRoute.pano, backwardRoute.heading, 4);
    }
  }, [loadPanoramaData, prefetchPanoramaNeighborhood, prefetchRouteAhead]);

  const prefetchMapillaryFrames = useCallback(
    (centerIndex: number, frames = mapillaryFrames) => {
      const start = Math.max(0, centerIndex - PREFETCH_FRAME_COUNT);
      const end = Math.min(frames.length, centerIndex + PREFETCH_FRAME_COUNT + 1);

      frames.slice(start, end).forEach((frame) => {
        void Image.prefetch(frame.imageUrl);
      });
    },
    [mapillaryFrames]
  );

  const loadMapillaryWalk = useCallback(async (accessToken: string) => {
    const bbox = [
      INITIAL_PLAYER_POSITION.lng - MAPILLARY_SEARCH_RADIUS_DEGREES,
      INITIAL_PLAYER_POSITION.lat - MAPILLARY_SEARCH_RADIUS_DEGREES,
      INITIAL_PLAYER_POSITION.lng + MAPILLARY_SEARCH_RADIUS_DEGREES,
      INITIAL_PLAYER_POSITION.lat + MAPILLARY_SEARCH_RADIUS_DEGREES,
    ].join(',');
    const params = new URLSearchParams({
      access_token: accessToken,
      bbox,
      limit: '80',
      fields:
        'id,thumb_2048_url,computed_geometry,computed_compass_angle,sequence,creator,is_pano',
    });
    const response = await fetch(`https://graph.mapillary.com/images?${params.toString()}`);

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as {
      data?: {
        id?: string;
        thumb_2048_url?: string;
        computed_geometry?: { coordinates?: [number, number] };
        computed_compass_angle?: number;
        sequence?: string;
        creator?: { username?: string };
      }[];
    };
    const frames = (payload.data ?? [])
      .map((item): MapillaryFrame | null => {
        const coordinates = item.computed_geometry?.coordinates;
        if (!item.id || !item.thumb_2048_url || !coordinates) {
          return null;
        }

        return {
          id: item.id,
          imageUrl: item.thumb_2048_url,
          sequence: item.sequence,
          lat: coordinates[1],
          lng: coordinates[0],
          heading: item.computed_compass_angle ?? 0,
          creator: item.creator?.username,
        };
      })
      .filter((frame): frame is MapillaryFrame => Boolean(frame));

    const sequenceCounts = frames.reduce<Record<string, number>>((counts, frame) => {
      if (!frame.sequence) {
        return counts;
      }

      counts[frame.sequence] = (counts[frame.sequence] ?? 0) + 1;
      return counts;
    }, {});
    const bestSequence = Object.entries(sequenceCounts).sort((first, second) => second[1] - first[1])[0]?.[0];
    const sequenceFrames = bestSequence
      ? frames.filter((frame) => frame.sequence === bestSequence)
      : frames;

    return sequenceFrames
      .sort(
        (first, second) =>
          distanceInMeters(INITIAL_PLAYER_POSITION, [first.lat, first.lng]) -
          distanceInMeters(INITIAL_PLAYER_POSITION, [second.lat, second.lng])
      )
      .slice(0, 60);
  }, []);

  const finishPanoramaTransition = useCallback(() => {
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }

    pendingMoveRef.current = false;
    Animated.parallel([
      Animated.timing(motionOpacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: false,
      }),
      Animated.timing(sceneScale, {
        toValue: 1,
        duration: 220,
        useNativeDriver: false,
      }),
      Animated.timing(sceneShift, {
        toValue: 0,
        duration: 220,
        useNativeDriver: false,
      }),
      Animated.timing(aiBlend, {
        toValue: 0,
        duration: 220,
        useNativeDriver: false,
      }),
    ]).start(() => setIsMoving(false));
  }, [aiBlend, motionOpacity, sceneScale, sceneShift]);

  const playMicroStep = useCallback(
    (reverse = false, currentSubstep: number, onComplete?: () => void) => {
      const progress = currentSubstep / MOVE_SUBSTEPS;
      const direction = reverse ? -1 : 1;

      playStepSound();
      setIsMoving(true);
      setMovementHint(`${reverse ? 'Voltando' : 'Avancando'} ${currentSubstep}/${MOVE_SUBSTEPS}`);
      motionOpacity.setValue(0.35);
      motionScale.setValue(1);
      aiBlend.setValue(0.25);
      walkAnimation.setValue(0);

      Animated.parallel([
        Animated.sequence([
          Animated.timing(walkAnimation, {
            toValue: 1,
            duration: 90,
            useNativeDriver: false,
          }),
          Animated.timing(walkAnimation, {
            toValue: 0,
            duration: 90,
            useNativeDriver: false,
          }),
        ]),
        Animated.timing(sceneScale, {
          toValue: 1 + progress * 0.018,
          duration: 210,
          useNativeDriver: false,
        }),
        Animated.timing(sceneShift, {
          toValue: direction * progress,
          duration: 210,
          useNativeDriver: false,
        }),
        Animated.sequence([
          Animated.timing(motionOpacity, {
            toValue: 0.52,
            duration: 70,
            useNativeDriver: false,
          }),
          Animated.timing(motionOpacity, {
            toValue: 0,
            duration: 160,
            useNativeDriver: false,
          }),
        ]),
        Animated.timing(aiBlend, {
          toValue: 0,
          duration: 230,
          useNativeDriver: false,
        }),
      ]).start(() => {
        if (onComplete) {
          onComplete();
          return;
        }

        setIsMoving(false);
        if (currentSubstep < MOVE_SUBSTEPS) {
          setMovementHint(null);
        }
      });
    },
    [aiBlend, motionOpacity, motionScale, playStepSound, sceneScale, sceneShift, walkAnimation]
  );

  useEffect(() => {
    const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    const mapillaryToken = process.env.EXPO_PUBLIC_MAPILLARY_ACCESS_TOKEN;
    const panoramaCache = panoramaCacheRef.current;
    const panoramaRequests = panoramaRequestsRef.current;
    let active = true;
    let positionListener: google.maps.MapsEventListener | undefined;
    let povListener: google.maps.MapsEventListener | undefined;

    const startStreetView = async () => {
      if (!apiKey) {
        setStreetViewError(
          'Defina EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ou EXPO_PUBLIC_MAPILLARY_ACCESS_TOKEN para ativar o passeio.'
        );
        return;
      }

      try {
        const { importLibrary, setOptions } = await import('@googlemaps/js-api-loader');
        setOptions({ key: apiKey, v: 'weekly', language: 'pt-BR', region: 'BR' });

        const { StreetViewPanorama, StreetViewPreference, StreetViewService, StreetViewSource } =
          await importLibrary('streetView');
        const service = new StreetViewService();
        streetViewServiceRef.current = service;
        const response = await service.getPanorama({
          location: INITIAL_PLAYER_POSITION,
          preference: StreetViewPreference.NEAREST,
          radius: 1000,
          sources: [StreetViewSource.OUTDOOR],
        });

        if (!active || !response.data.location?.pano) {
          return;
        }

        const panorama = new StreetViewPanorama(panoramaContainerRef.current, {
          pano: response.data.location.pano,
          pov: { heading: 0, pitch: 0 },
          zoom: 1,
          addressControl: false,
          clickToGo: true,
          linksControl: false,
          panControl: false,
          zoomControl: false,
          motionTracking: false,
          motionTrackingControl: false,
          showRoadLabels: false,
          enableCloseButton: false,
          fullscreenControl: false,
          visible: true,
        });

        panoramaRef.current = panorama;
        panoramaCacheRef.current.set(response.data.location.pano, response.data);
        setViewProvider('google');
        setPlayerHeading(panorama.getPov().heading);
        positionListener = panorama.addListener('position_changed', () => {
          const location = panorama.getPosition();
          if (!location) {
            return;
          }

          setPlayerPosition({ lat: location.lat(), lng: location.lng() });
          animateWalk();

          if (pendingMoveRef.current) {
            finishPanoramaTransition();
          }

          prefetchVisibleRoutes();
        });
        povListener = panorama.addListener('pov_changed', () => {
          setPlayerHeading(panorama.getPov().heading);
        });
        setStreetViewReady(true);
        prefetchVisibleRoutes();
      } catch {
        if (active) {
          setStreetViewError(
            'Nao encontrei Street View ativo para esta area ou a chave da API nao esta habilitada.'
          );
        }
      }
    };

    const startWalkProvider = async () => {
      if (mapillaryToken) {
        const frames = await loadMapillaryWalk(mapillaryToken);

        if (active && frames.length >= 3) {
          setMapillaryFrames(frames);
          setCurrentFrameIndex(0);
          setPreviousFrameUrl(null);
          setPlayerPosition({ lat: frames[0].lat, lng: frames[0].lng });
          setPlayerHeading(frames[0].heading);
          setViewProvider('mapillary');
          setStreetViewReady(true);
          prefetchMapillaryFrames(0, frames);
          return;
        }
      }

      await startStreetView();
    };

    startWalkProvider();

    return () => {
      active = false;
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
      positionListener?.remove();
      povListener?.remove();
      panoramaRef.current?.setVisible(false);
      panoramaRef.current = null;
      streetViewServiceRef.current = null;
      panoramaCache.clear();
      panoramaRequests.clear();
      stopMissionMusic();
    };
  }, [
    animateWalk,
    finishPanoramaTransition,
    loadMapillaryWalk,
    prefetchMapillaryFrames,
    prefetchVisibleRoutes,
    stopMissionMusic,
  ]);

  const moveOnStreet = useCallback(async (reverse = false) => {
    if (isMoving) {
      return;
    }

    if (viewProvider === 'mapillary') {
      const direction = reverse ? -1 : 1;
      const nextIndex = reverse
        ? Math.max(0, currentFrameIndex - 1)
        : Math.min(mapillaryFrames.length - 1, currentFrameIndex + 1);

      if (nextIndex === currentFrameIndex) {
        setMovementHint('Nao ha proximo frame nessa direcao.');
        setTimeout(() => setMovementHint(null), 1600);
        return;
      }

      const nextSubstep =
        moveSubstepRef.current.direction === direction ? moveSubstepRef.current.count + 1 : 1;
      moveSubstepRef.current = { direction, count: nextSubstep };

      if (nextSubstep < MOVE_SUBSTEPS) {
        playMicroStep(reverse, nextSubstep);
        if (nextSubstep === MOVE_SUBSTEPS - 1) {
          prefetchMapillaryFrames(nextIndex);
        }
        return;
      }

      moveSubstepRef.current = { direction: 0, count: 0 };
      const currentFrame = mapillaryFrames[currentFrameIndex];
      const nextFrame = mapillaryFrames[nextIndex];
      playMicroStep(reverse, MOVE_SUBSTEPS, () => {
        pendingMoveRef.current = true;
        steeringBiasRef.current *= 0.45;
        setPreviousFrameUrl(currentFrame?.imageUrl ?? null);
        setHasWalked(true);
        prefetchMapillaryFrames(nextIndex);
        setCurrentFrameIndex(nextIndex);
        setPlayerPosition({ lat: nextFrame.lat, lng: nextFrame.lng });
        setPlayerHeading(nextFrame.heading);
        finishPanoramaTransition();
        window.setTimeout(() => setPreviousFrameUrl(null), 180);
      });
      return;
    }

    const panorama = panoramaRef.current;
    const links = getStreetLinks(panorama?.getLinks());
    if (!panorama || !links?.length) {
      setMovementHint('Nao ha proximo panorama nessa direcao.');
      setTimeout(() => setMovementHint(null), 1600);
      return;
    }

    const currentHeading = panorama.getPov().heading;
    const virtualClickHeading = getVirtualClickHeading(currentHeading, steeringBiasRef.current);
    const desiredHeading = reverse ? currentHeading + 180 : virtualClickHeading;
    const route = reverse
      ? getClosestStreetLink(links, desiredHeading)
      : getPreferredStreetLink(links, desiredHeading, steeringBiasRef.current);
    const direction = reverse ? -1 : 1;
    const nextSubstep =
      moveSubstepRef.current.direction === direction ? moveSubstepRef.current.count + 1 : 1;
    moveSubstepRef.current = { direction, count: nextSubstep };

    if (nextSubstep < MOVE_SUBSTEPS) {
      playMicroStep(reverse, nextSubstep);
      if (nextSubstep === MOVE_SUBSTEPS - 1) {
        void loadPanoramaData(route.pano);
        void prefetchRouteAhead(route.pano, route.heading, PREFETCH_FRAME_COUNT);
        void prefetchPanoramaNeighborhood(route.pano, route.heading, PREFETCH_FRAME_COUNT);
      }
      return;
    }

    moveSubstepRef.current = { direction: 0, count: 0 };
    playMicroStep(reverse, MOVE_SUBSTEPS, () => {
      pendingMoveRef.current = true;
      steeringBiasRef.current *= 0.45;
      setHasWalked(true);
      void prefetchRouteAhead(route.pano, route.heading, PREFETCH_FRAME_COUNT);
      void prefetchPanoramaNeighborhood(route.pano, route.heading, PREFETCH_FRAME_COUNT);

      void loadPanoramaData(route.pano).finally(() => {
        panorama.setPano(route.pano);
        panorama.setPov({ heading: route.heading, pitch: 0 });
      });
    });
  }, [
    currentFrameIndex,
    finishPanoramaTransition,
    isMoving,
    loadPanoramaData,
    mapillaryFrames,
    playMicroStep,
    prefetchMapillaryFrames,
    prefetchPanoramaNeighborhood,
    prefetchRouteAhead,
    viewProvider,
  ]);

  const turnView = useCallback((amount: number) => {
    moveSubstepRef.current = { direction: 0, count: 0 };
    steeringBiasRef.current = Math.max(-1, Math.min(1, steeringBiasRef.current + amount / 30));
    Animated.parallel([
      Animated.timing(sceneScale, {
        toValue: 1,
        duration: 160,
        useNativeDriver: false,
      }),
      Animated.timing(sceneShift, {
        toValue: 0,
        duration: 160,
        useNativeDriver: false,
      }),
    ]).start();

    if (viewProvider === 'mapillary') {
      const direction = amount > 0 ? 1 : -1;
      const nextIndex = Math.min(
        mapillaryFrames.length - 1,
        Math.max(0, currentFrameIndex + direction)
      );

      if (nextIndex !== currentFrameIndex) {
        setPreviousFrameUrl(mapillaryFrames[currentFrameIndex]?.imageUrl ?? null);
        setCurrentFrameIndex(nextIndex);
        setPlayerPosition({ lat: mapillaryFrames[nextIndex].lat, lng: mapillaryFrames[nextIndex].lng });
        setPlayerHeading(mapillaryFrames[nextIndex].heading);
        prefetchMapillaryFrames(nextIndex);
        window.setTimeout(() => setPreviousFrameUrl(null), 320);
      }
      return;
    }

    const panorama = panoramaRef.current;
    if (!panorama) {
      return;
    }

    const view = panorama.getPov();
    panorama.setPov({ heading: view.heading + amount, pitch: view.pitch });
    window.setTimeout(prefetchVisibleRoutes, 120);
  }, [
    currentFrameIndex,
    mapillaryFrames,
    prefetchMapillaryFrames,
    prefetchVisibleRoutes,
    sceneScale,
    sceneShift,
    viewProvider,
  ]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      if (key === 'w' || key === 'arrowup') {
        event.preventDefault();
        startMissionMusic();
        moveOnStreet();
      } else if (key === 's' || key === 'arrowdown') {
        event.preventDefault();
        startMissionMusic();
        moveOnStreet(true);
      } else if (key === 'a' || key === 'arrowleft') {
        event.preventDefault();
        startMissionMusic();
        turnView(-TURN_STEP_DEGREES);
      } else if (key === 'd' || key === 'arrowright') {
        event.preventDefault();
        startMissionMusic();
        turnView(TURN_STEP_DEGREES);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [moveOnStreet, startMissionMusic, turnView]);

  useEffect(() => {
    if (!hasWalked) {
      return;
    }

    const nextNearbyPoints = new Set<string>();

    touristicPoints.forEach((point) => {
      if (distanceInMeters(playerPosition, point.coordinates) <= INTERACTION_DISTANCE_METERS) {
        nextNearbyPoints.add(point.id);
      }
    });

    if (
      currentMissionPoint &&
      !visitedPoints.has(currentMissionPoint.id) &&
      distanceInMeters(playerPosition, currentMissionPoint.coordinates) <= MISSION_COMPLETE_METERS
    ) {
      setVisitedPoints((previous) => new Set([...previous, currentMissionPoint.id]));
      setScore((previous) => previous + 10);
      onPointVisited?.(currentMissionPoint);

      if (visitedPoints.size === 0) {
        onBadgeUnlocked?.('first_step');
      }
    }

    setNearbyPoints(nextNearbyPoints);
  }, [
    currentMissionPoint,
    hasWalked,
    onBadgeUnlocked,
    onPointVisited,
    playerPosition,
    visitedPoints,
  ]);

  useEffect(() => {
    if (visitedPoints.size === touristicPoints.length && visitedPoints.size > 0) {
      onBadgeUnlocked?.('explorer');
    }
  }, [onBadgeUnlocked, visitedPoints]);

  const nearbyPoint = touristicPoints.find((point) => nearbyPoints.has(point.id));
  const characterMovement = walkAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -3],
  });
  const bodyLean = walkAnimation.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['0deg', '2deg', '0deg'],
  });
  const leftLegStep = walkAnimation.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['-5deg', '7deg', '-5deg'],
  });
  const rightLegStep = walkAnimation.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['7deg', '-5deg', '7deg'],
  });
  const sceneTranslateY = sceneShift.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [-18, 0, 24],
  });
  const pathOpacity = motionOpacity.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.38],
  });
  const aiBlendOpacity = aiBlend.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.42],
  });
  const aiFrameShift = aiBlend.interpolate({
    inputRange: [0, 1],
    outputRange: [18, -18],
  });

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.panoramaFrame,
          {
            transform: [{ scale: sceneScale }, { translateY: sceneTranslateY }],
          },
        ]}
      >
        {viewProvider === 'mapillary' && activeMapillaryFrame ? (
          <View style={styles.mapillaryScene}>
            {previousFrameUrl && (
              <Image source={{ uri: previousFrameUrl }} style={styles.mapillaryImage} />
            )}
            <Image source={{ uri: activeMapillaryFrame.imageUrl }} style={styles.mapillaryImage} />
            <Animated.View style={[styles.mapillaryAiBlend, { opacity: aiBlendOpacity }]} />
            <View style={styles.mapillaryAttribution}>
              <Text style={styles.mapillaryAttributionText}>
                Mapillary CC-BY-SA{activeMapillaryFrame.creator ? ` - ${activeMapillaryFrame.creator}` : ''}
              </Text>
            </View>
          </View>
        ) : (
          <View ref={panoramaContainerRef} style={styles.panorama} />
        )}
      </Animated.View>
      {!streetViewReady && (
        <View style={styles.loadingContainer}>
          {streetViewError ? (
            <>
              <Text style={styles.configurationTitle}>Street View</Text>
              <Text style={styles.configurationText}>{streetViewError}</Text>
              <Text style={styles.configurationHint}>
                Habilite Maps JavaScript API no Google Cloud e reinicie o Expo.
              </Text>
            </>
          ) : (
            <>
              <ActivityIndicator size="large" color="#4ECDC4" />
              <Text style={styles.loadingText}>Buscando imagens caminhaveis de Oeiras...</Text>
            </>
          )}
        </View>
      )}

      {streetViewReady && (
        <>
          <View style={styles.overlay}>
            <View style={styles.hud}>
              <Text style={styles.providerText}>
                {viewProvider === 'mapillary'
                  ? `Mapillary + IA visual (${mapillaryFrames.length} frames)`
                  : 'Street View com suavizacao visual'}
              </Text>
              <Text style={styles.scoreText}>Pontos: {score}</Text>
              <Text style={styles.visitedText}>
                Visitados: {visitedPoints.size}/{touristicPoints.length}
              </Text>
              {currentMissionPoint && (
                <>
                  <Text style={styles.missionText}>Missao: {currentMissionPoint.name}</Text>
                  <Text style={styles.missionDistanceText}>{missionDistance}m ate o alvo</Text>
                </>
              )}
              <TouchableOpacity style={styles.musicButton} onPress={toggleMissionMusic}>
                <Text style={styles.musicButtonText}>
                  {musicEnabled ? 'Musica: ON' : 'Musica: OFF'}
                </Text>
              </TouchableOpacity>
            </View>
            {nearbyPoint && (
              <TouchableOpacity
                style={styles.nearbyButton}
                onPress={() => setSelectedPoint(nearbyPoint)}
              >
                <Text style={styles.nearbyText}>Ver: {nearbyPoint.name}</Text>
              </TouchableOpacity>
            )}
          </View>

          {currentMissionPoint && (
            <View style={styles.missionArrowContainer}>
              <View
                style={[
                  styles.missionArrow,
                  { transform: [{ rotate: `${missionArrowRotation}deg` }] },
                ]}
              >
                <View style={styles.missionArrowTip} />
                <View style={styles.missionArrowBody} />
                <View style={styles.missionArrowWingLeft} />
                <View style={styles.missionArrowWingRight} />
              </View>
              <Text style={styles.missionArrowLabel}>{currentMissionPoint.name}</Text>
            </View>
          )}

          <View style={styles.gtaMiniMap}>
            {miniMapRoadSegments.map((segment) => (
              <View
                key={segment.key}
                style={[
                  styles.miniMapRoadSegment,
                  {
                    left: segment.left,
                    top: segment.top,
                    width: segment.width,
                    transform: [{ rotate: segment.angle }],
                  },
                ]}
              />
            ))}
            {touristicPoints.map((point) => {
              const projected = projectToCenteredMiniMap(point.coordinates, playerPosition);

              return (
                <View
                  key={`cross-${point.id}`}
                  style={[styles.miniMapRoadCross, projected]}
                />
              );
            })}
            <Text style={[styles.compassLetter, styles.compassNorth]}>N</Text>
            <Text style={[styles.compassLetter, styles.compassSouth]}>S</Text>
            <Text style={[styles.compassLetter, styles.compassWest]}>O</Text>
            <Text style={[styles.compassLetter, styles.compassEast]}>L</Text>
            {touristicPoints.map((point) => {
              const projected = projectToCenteredMiniMap(point.coordinates, playerPosition);
              const isVisited = visitedPoints.has(point.id);
              const isMission = currentMissionPoint?.id === point.id;

              return (
                <View
                  key={point.id}
                  style={[
                    styles.miniMapPoint,
                    projected,
                    isVisited && styles.miniMapVisitedPoint,
                    isMission && styles.miniMapMissionPoint,
                  ]}
                >
                  <Text style={styles.miniMapPointText}>{isVisited ? '✓' : '!'}</Text>
                </View>
              );
            })}
            <View style={[styles.miniMapPlayer, playerMiniMapPosition]}>
              <Text
                style={[
                  styles.miniMapPlayerArrow,
                  { transform: [{ rotate: `${playerHeading}deg` }] },
                ]}
              >
                ▲
              </Text>
            </View>
          </View>

          <Animated.View
            style={[styles.player, { transform: [{ translateY: characterMovement }] }]}
          >
            <Animated.View style={[styles.playerUpper, { transform: [{ rotate: bodyLean }] }]}>
              <View style={styles.playerHead} />
              <View style={styles.playerBody} />
            </Animated.View>
            <View style={styles.playerLegs}>
              <Animated.View
                style={[styles.playerLeg, { transform: [{ rotate: leftLegStep }] }]}
              />
              <Animated.View
                style={[styles.playerLeg, { transform: [{ rotate: rightLegStep }] }]}
              />
            </View>
            <View style={styles.playerShadow} />
          </Animated.View>

          {isMissionZoneOnScreen && currentMissionPoint && (
            <View
              style={[
                styles.missionZone,
                {
                  left: `${missionZoneHorizontalPercent}%`,
                  top: `${missionZoneVerticalPercent}%`,
                  transform: [{ scale: missionZoneScale }],
                },
              ]}
            >
              <View style={styles.missionZoneInner} />
              <Text style={styles.missionZoneText}>MISSÃO</Text>
            </View>
          )}

          <View
            style={[
              styles.virtualWalkTarget,
              {
                transform: [
                  { translateX: steeringBiasRef.current * 34 },
                  { rotate: `${steeringBiasRef.current * 10}deg` },
                ],
              },
            ]}
          />

          {isMoving && (
            <Animated.View
              style={[
                styles.motionOverlay,
                {
                  opacity: motionOpacity,
                  transform: [{ scale: motionScale }],
                },
              ]}
            >
              <Animated.View style={[styles.roadFocus, { opacity: pathOpacity }]} />
              <Animated.View
                style={[
                  styles.aiInterpolationLayer,
                  {
                    opacity: aiBlendOpacity,
                    transform: [{ translateY: aiFrameShift }],
                  },
                ]}
              >
                {Array.from({ length: PREFETCH_FRAME_COUNT }).map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.aiFrameLine,
                      {
                        opacity: 1 - index * 0.075,
                        width: `${92 - index * 5}%`,
                      },
                    ]}
                  />
                ))}
              </Animated.View>
              <Animated.View style={[styles.motionVignette, { opacity: motionOpacity }]} />
              <View style={styles.motionBreath} />
              <Text style={styles.motionText}>{movementHint}</Text>
            </Animated.View>
          )}

          <View style={styles.streetControls}>
            <TouchableOpacity
              disabled={isMoving}
              style={[styles.controlButton, isMoving && styles.disabledButton]}
              onPress={() => {
                startMissionMusic();
                turnView(-TURN_STEP_DEGREES);
              }}
            >
              <Text style={styles.controlButtonText}>Virar E</Text>
            </TouchableOpacity>
            <View>
              <TouchableOpacity
                disabled={isMoving}
                style={[styles.walkButton, isMoving && styles.disabledButton]}
                onPress={() => {
                  startMissionMusic();
                  moveOnStreet();
                }}
              >
                <Text style={styles.controlButtonText}>Andar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={isMoving}
                style={[styles.backButton, isMoving && styles.disabledButton]}
                onPress={() => {
                  startMissionMusic();
                  moveOnStreet(true);
                }}
              >
                <Text style={styles.backButtonText}>Voltar</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              disabled={isMoving}
              style={[styles.controlButton, isMoving && styles.disabledButton]}
              onPress={() => {
                startMissionMusic();
                turnView(TURN_STEP_DEGREES);
              }}
            >
              <Text style={styles.controlButtonText}>Virar D</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      <Modal
        visible={selectedPoint !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedPoint(null)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <TouchableOpacity style={styles.closeButton} onPress={() => setSelectedPoint(null)}>
              <Text style={styles.closeButtonText}>X</Text>
            </TouchableOpacity>
            {selectedPoint && (
              <>
                <Text style={styles.modalTitle}>
                  {selectedPoint.icon} {selectedPoint.name}
                </Text>
                <Text style={styles.modalDescription}>{selectedPoint.description}</Text>
                <View style={styles.factsContainer}>
                  <Text style={styles.factsTitle}>Curiosidades:</Text>
                  {selectedPoint.facts.map((fact) => (
                    <Text key={fact} style={styles.factItem}>
                      - {fact}
                    </Text>
                  ))}
                </View>
                <TouchableOpacity
                  style={styles.closeModalButton}
                  onPress={() => setSelectedPoint(null)}
                >
                  <Text style={styles.closeModalButtonText}>Fechar</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', height: '100%', position: 'relative' },
  panoramaFrame: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    backgroundColor: '#101820',
  },
  panorama: { width: '100%', height: '100%' },
  mapillaryScene: {
    width: '100%',
    height: '100%',
    backgroundColor: '#101820',
  },
  mapillaryImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  mapillaryAiBlend: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  mapillaryAttribution: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  mapillaryAttributionText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3ead8',
    paddingHorizontal: 28,
  },
  loadingText: { color: '#257b77', fontSize: 15, marginTop: 12 },
  configurationTitle: { fontSize: 28, fontWeight: 'bold', color: '#263238', marginBottom: 14 },
  configurationText: {
    maxWidth: 460,
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 23,
    color: '#263238',
  },
  configurationHint: {
    maxWidth: 460,
    textAlign: 'center',
    color: '#59676c',
    fontSize: 13,
    marginTop: 15,
  },
  overlay: { position: 'absolute', top: 18, left: 18, right: 18, zIndex: 1000 },
  hud: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(18, 27, 31, 0.8)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
  },
  providerText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  scoreText: { color: '#FFD93D', fontSize: 16, fontWeight: 'bold', marginBottom: 5 },
  visitedText: { color: '#4ECDC4', fontSize: 14 },
  missionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 8,
    maxWidth: 220,
  },
  missionDistanceText: {
    color: '#FFD93D',
    fontSize: 12,
    marginTop: 2,
  },
  musicButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 217, 61, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 217, 61, 0.45)',
  },
  musicButtonText: {
    color: '#FFD93D',
    fontSize: 11,
    fontWeight: 'bold',
  },
  nearbyButton: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#FFD93D',
  },
  nearbyText: { color: '#283238', fontSize: 14, fontWeight: 'bold' },
  missionArrowContainer: {
    position: 'absolute',
    top: 132,
    left: '50%',
    marginLeft: -95,
    width: 190,
    alignItems: 'center',
    zIndex: 1000,
  },
  missionArrow: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.48)',
    borderWidth: 3,
    borderColor: '#FFD93D',
  },
  missionArrowTip: {
    position: 'absolute',
    top: 6,
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderBottomWidth: 26,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#FFD93D',
  },
  missionArrowBody: {
    position: 'absolute',
    top: 27,
    width: 10,
    height: 17,
    borderRadius: 5,
    backgroundColor: '#FFD93D',
  },
  missionArrowWingLeft: {
    position: 'absolute',
    top: 31,
    left: 14,
    width: 13,
    height: 8,
    borderRadius: 5,
    backgroundColor: '#FFD93D',
    transform: [{ rotate: '-34deg' }],
  },
  missionArrowWingRight: {
    position: 'absolute',
    top: 31,
    right: 14,
    width: 13,
    height: 8,
    borderRadius: 5,
    backgroundColor: '#FFD93D',
    transform: [{ rotate: '34deg' }],
  },
  missionArrowLabel: {
    marginTop: 7,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    overflow: 'hidden',
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  gtaMiniMap: {
    position: 'absolute',
    left: 18,
    bottom: 18,
    width: MINI_MAP_SIZE,
    height: MINI_MAP_SIZE,
    borderRadius: MINI_MAP_SIZE / 2,
    overflow: 'hidden',
    zIndex: 1000,
    backgroundColor: '#e7ede9',
    borderWidth: 6,
    borderColor: '#080808',
  },
  miniMapRoadSegment: {
    position: 'absolute',
    height: 16,
    marginTop: -8,
    borderRadius: 14,
    backgroundColor: '#28343b',
    borderWidth: 2,
    borderColor: '#f8f8f2',
    transformOrigin: 'left center',
  },
  miniMapRoadCross: {
    position: 'absolute',
    width: 30,
    height: 30,
    marginLeft: -15,
    marginTop: -15,
    borderRadius: 15,
    backgroundColor: '#28343b',
    borderWidth: 2,
    borderColor: '#f8f8f2',
  },
  compassLetter: {
    position: 'absolute',
    color: '#050505',
    fontSize: 19,
    fontWeight: 'bold',
    textShadowColor: '#fff',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  compassNorth: { top: 7, left: MINI_MAP_SIZE / 2 - 9 },
  compassSouth: { bottom: 7, left: MINI_MAP_SIZE / 2 - 9 },
  compassWest: { left: 10, top: MINI_MAP_SIZE / 2 - 12 },
  compassEast: { right: 10, top: MINI_MAP_SIZE / 2 - 12 },
  miniMapPoint: {
    position: 'absolute',
    width: 18,
    height: 18,
    marginLeft: -9,
    marginTop: -9,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffcf3f',
    borderWidth: 2,
    borderColor: '#111',
  },
  miniMapMissionPoint: {
    backgroundColor: '#ff4d4d',
    transform: [{ scale: 1.2 }],
  },
  miniMapVisitedPoint: {
    backgroundColor: '#4ECDC4',
  },
  miniMapPointText: {
    color: '#111',
    fontSize: 10,
    fontWeight: 'bold',
  },
  miniMapPlayer: {
    position: 'absolute',
    width: 24,
    height: 24,
    marginLeft: -12,
    marginTop: -12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#111',
  },
  miniMapPlayerArrow: {
    color: '#246BFD',
    fontSize: 15,
    fontWeight: 'bold',
  },
  player: {
    position: 'absolute',
    bottom: 104,
    left: '50%',
    marginLeft: -18,
    alignItems: 'center',
    zIndex: 950,
    opacity: 0.88,
  },
  playerUpper: {
    alignItems: 'center',
  },
  playerHead: {
    width: 18,
    height: 18,
    borderRadius: 10,
    backgroundColor: '#f2b786',
    borderWidth: 2,
    borderColor: '#27323a',
  },
  playerBody: {
    width: 28,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#f85f64',
    borderWidth: 2,
    borderColor: '#27323a',
  },
  playerLegs: {
    flexDirection: 'row',
    gap: 7,
    marginTop: -2,
  },
  playerLeg: {
    width: 8,
    height: 20,
    borderRadius: 5,
    backgroundColor: '#284b63',
    borderWidth: 1,
    borderColor: '#27323a',
    transformOrigin: 'top center',
  },
  playerShadow: {
    width: 42,
    height: 9,
    borderRadius: 20,
    marginTop: -2,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  missionZone: {
    position: 'absolute',
    marginLeft: -62,
    marginTop: -26,
    width: 124,
    height: 52,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 930,
    backgroundColor: 'rgba(255, 35, 35, 0.22)',
    borderWidth: 4,
    borderColor: 'rgba(255, 45, 45, 0.72)',
  },
  missionZoneInner: {
    position: 'absolute',
    width: 76,
    height: 28,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 55, 55, 0.25)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.55)',
  },
  missionZoneText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
    textShadowColor: '#8a0000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  virtualWalkTarget: {
    position: 'absolute',
    bottom: 205,
    left: '50%',
    marginLeft: -34,
    width: 68,
    height: 20,
    borderRadius: 999,
    zIndex: 925,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.42)',
  },
  motionOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 920,
    backgroundColor: 'rgba(8, 13, 18, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  motionVignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4, 8, 13, 0.22)',
  },
  roadFocus: {
    position: 'absolute',
    left: '30%',
    right: '30%',
    bottom: 48,
    height: '31%',
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    transform: [{ scaleX: 1.75 }],
  },
  aiInterpolationLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 86,
    height: '44%',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  aiFrameLine: {
    height: 2,
    marginTop: 9,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  motionBreath: {
    position: 'absolute',
    left: '12%',
    right: '12%',
    bottom: 88,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  motionText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    marginBottom: 120,
  },
  streetControls: {
    position: 'absolute',
    bottom: 22,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 1000,
  },
  controlButton: {
    backgroundColor: 'rgba(18, 27, 31, 0.82)',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 14,
  },
  walkButton: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 14,
    marginBottom: 4,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(18, 27, 31, 0.82)',
    paddingVertical: 7,
    borderRadius: 10,
  },
  disabledButton: {
    opacity: 0.55,
  },
  controlButtonText: { fontSize: 14, color: '#fff', fontWeight: 'bold' },
  backButtonText: { fontSize: 12, color: '#fff', fontWeight: 'bold' },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    minHeight: '55%',
  },
  closeButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  modalTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 10, marginTop: 10, color: '#333' },
  modalDescription: { fontSize: 16, color: '#555', marginBottom: 15, lineHeight: 22 },
  factsContainer: { marginBottom: 20, paddingLeft: 10 },
  factsTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 8, color: '#333' },
  factItem: { fontSize: 14, color: '#666', marginBottom: 5, lineHeight: 20 },
  closeModalButton: { backgroundColor: '#FF6B6B', padding: 15, borderRadius: 10, alignItems: 'center' },
  closeModalButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
