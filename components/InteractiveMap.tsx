import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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

const headingDifference = (first: number, second: number) =>
  Math.abs(((first - second + 540) % 360) - 180);

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  onPointVisited,
  onBadgeUnlocked,
}) => {
  const panoramaContainerRef = useRef<any>(null);
  const panoramaRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const walkAnimation = useRef(new Animated.Value(0)).current;
  const [streetViewReady, setStreetViewReady] = useState(false);
  const [streetViewError, setStreetViewError] = useState<string | null>(null);
  const [playerPosition, setPlayerPosition] = useState<PlayerPosition>(INITIAL_PLAYER_POSITION);
  const [hasWalked, setHasWalked] = useState(false);
  const [visitedPoints, setVisitedPoints] = useState<Set<string>>(new Set());
  const [selectedPoint, setSelectedPoint] = useState<TouristicPoint | null>(null);
  const [nearbyPoints, setNearbyPoints] = useState<Set<string>>(new Set());
  const [score, setScore] = useState(0);

  const animateWalk = useCallback(() => {
    walkAnimation.setValue(0);
    Animated.sequence([
      Animated.timing(walkAnimation, { toValue: 1, duration: 140, useNativeDriver: false }),
      Animated.timing(walkAnimation, { toValue: 0, duration: 140, useNativeDriver: false }),
    ]).start();
  }, [walkAnimation]);

  useEffect(() => {
    const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    let active = true;
    let positionListener: google.maps.MapsEventListener | undefined;

    if (!apiKey) {
      setStreetViewError(
        'Defina EXPO_PUBLIC_GOOGLE_MAPS_API_KEY para ativar o passeio Street View.'
      );
      return;
    }

    const startStreetView = async () => {
      try {
        const { importLibrary, setOptions } = await import('@googlemaps/js-api-loader');
        setOptions({ key: apiKey, v: 'weekly', language: 'pt-BR', region: 'BR' });

        const { StreetViewPanorama, StreetViewPreference, StreetViewService, StreetViewSource } =
          await importLibrary('streetView');
        const service = new StreetViewService();
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
        positionListener = panorama.addListener('position_changed', () => {
          const location = panorama.getPosition();
          if (!location) {
            return;
          }

          setPlayerPosition({ lat: location.lat(), lng: location.lng() });
          animateWalk();
        });
        setStreetViewReady(true);
      } catch {
        if (active) {
          setStreetViewError(
            'Nao encontrei Street View ativo para esta area ou a chave da API nao esta habilitada.'
          );
        }
      }
    };

    startStreetView();

    return () => {
      active = false;
      positionListener?.remove();
      panoramaRef.current?.setVisible(false);
      panoramaRef.current = null;
    };
  }, [animateWalk]);

  const moveOnStreet = useCallback((reverse = false) => {
    const panorama = panoramaRef.current;
    const links = (panorama?.getLinks() ?? []).filter(
      (link): link is google.maps.StreetViewLink & { pano: string; heading: number } =>
        Boolean(link?.pano) && typeof link?.heading === 'number'
    );
    if (!panorama || !links?.length) {
      return;
    }

    const currentHeading = panorama.getPov().heading;
    const desiredHeading = reverse ? currentHeading + 180 : currentHeading;
    const route = links.reduce((best, candidate) =>
      headingDifference(candidate.heading, desiredHeading) <
      headingDifference(best.heading, desiredHeading)
        ? candidate
        : best
    );

    setHasWalked(true);
    panorama.setPano(route.pano);
    panorama.setPov({ heading: route.heading, pitch: 0 });
  }, []);

  const turnView = useCallback((amount: number) => {
    const panorama = panoramaRef.current;
    if (!panorama) {
      return;
    }

    const view = panorama.getPov();
    panorama.setPov({ heading: view.heading + amount, pitch: view.pitch });
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      if (key === 'w' || key === 'arrowup') {
        event.preventDefault();
        moveOnStreet();
      } else if (key === 's' || key === 'arrowdown') {
        event.preventDefault();
        moveOnStreet(true);
      } else if (key === 'a' || key === 'arrowleft') {
        event.preventDefault();
        turnView(-30);
      } else if (key === 'd' || key === 'arrowright') {
        event.preventDefault();
        turnView(30);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [moveOnStreet, turnView]);

  useEffect(() => {
    if (!hasWalked) {
      return;
    }

    const nextNearbyPoints = new Set<string>();

    touristicPoints.forEach((point) => {
      if (distanceInMeters(playerPosition, point.coordinates) <= INTERACTION_DISTANCE_METERS) {
        nextNearbyPoints.add(point.id);
        if (!visitedPoints.has(point.id)) {
          setVisitedPoints((previous) => new Set([...previous, point.id]));
          setScore((previous) => previous + 10);
          onPointVisited?.(point);

          if (visitedPoints.size === 0) {
            onBadgeUnlocked?.('first_step');
          }
        }
      }
    });

    setNearbyPoints(nextNearbyPoints);
  }, [hasWalked, onBadgeUnlocked, onPointVisited, playerPosition, visitedPoints]);

  useEffect(() => {
    if (visitedPoints.size === touristicPoints.length && visitedPoints.size > 0) {
      onBadgeUnlocked?.('explorer');
    }
  }, [onBadgeUnlocked, visitedPoints]);

  const nearbyPoint = touristicPoints.find((point) => nearbyPoints.has(point.id));
  const characterMovement = walkAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  });

  return (
    <View style={styles.container}>
      <View ref={panoramaContainerRef} style={styles.panorama} />
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
              <Text style={styles.loadingText}>Buscando as ruas de Oeiras...</Text>
            </>
          )}
        </View>
      )}

      {streetViewReady && (
        <>
          <View style={styles.overlay}>
            <View style={styles.hud}>
              <Text style={styles.scoreText}>Pontos: {score}</Text>
              <Text style={styles.visitedText}>
                Visitados: {visitedPoints.size}/{touristicPoints.length}
              </Text>
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

          <Animated.View
            style={[
              styles.player,
              { transform: [{ translateY: characterMovement }] },
            ]}
          >
            <View style={styles.playerHead} />
            <View style={styles.playerBody} />
            <View style={styles.playerLegs}>
              <View style={styles.playerLeg} />
              <View style={styles.playerLeg} />
            </View>
          </Animated.View>

          <View style={styles.streetControls}>
            <TouchableOpacity style={styles.controlButton} onPress={() => turnView(-30)}>
              <Text style={styles.controlButtonText}>Virar E</Text>
            </TouchableOpacity>
            <View>
              <TouchableOpacity style={styles.walkButton} onPress={() => moveOnStreet()}>
                <Text style={styles.controlButtonText}>Andar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.backButton} onPress={() => moveOnStreet(true)}>
                <Text style={styles.backButtonText}>Voltar</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.controlButton} onPress={() => turnView(30)}>
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
  panorama: { width: '100%', height: '100%' },
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
  scoreText: { color: '#FFD93D', fontSize: 16, fontWeight: 'bold', marginBottom: 5 },
  visitedText: { color: '#4ECDC4', fontSize: 14 },
  nearbyButton: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#FFD93D',
  },
  nearbyText: { color: '#283238', fontSize: 14, fontWeight: 'bold' },
  player: {
    position: 'absolute',
    bottom: 108,
    left: '50%',
    marginLeft: -15,
    alignItems: 'center',
    zIndex: 950,
    opacity: 0.9,
  },
  playerHead: {
    width: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: '#f2b786',
    borderWidth: 2,
    borderColor: '#27323a',
  },
  playerBody: {
    width: 26,
    height: 29,
    borderRadius: 8,
    backgroundColor: '#FF6B6B',
    borderWidth: 2,
    borderColor: '#27323a',
  },
  playerLegs: { flexDirection: 'row', gap: 6 },
  playerLeg: {
    width: 7,
    height: 17,
    borderRadius: 4,
    backgroundColor: '#284b63',
    borderWidth: 1,
    borderColor: '#27323a',
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
