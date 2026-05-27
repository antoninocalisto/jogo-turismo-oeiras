# 📖 Guia de Customização - Jogo de Turismo de Oeiras

## 🎯 Como Adicionar Novos Pontos Turísticos

1. Abra o arquivo `data/touristicPoints.ts`

2. Adicione um novo objeto à array `touristicPoints`:

```typescript
{
  id: "seu-id",
  name: "Nome do Ponto Turístico",
  description: "Descrição detalhada do local",
  coordinates: [-4.9667, -42.4667], // [latitude, longitude]
  icon: "🏠", // Emoji do ícone
  photos: [
    "https://link-para-foto.jpg",
  ],
  facts: [
    "Fato 1 sobre o local",
    "Fato 2 sobre o local",
    "Fato 3 sobre o local",
  ],
}
```

### 🗺️ Encontrar Coordenadas

Use https://www.openstreetmap.org para encontrar as coordenadas:
1. Procure o local no mapa
2. Clique no local
3. As coordenadas aparecem na URL

## 🎨 Customizando o Estilo

### Cores Principais

Abra `components/InteractiveMap.tsx` e procure por:
- `#FF6B6B` - Cor do personagem (vermelho)
- `#4ECDC4` - Cor dos pontos turísticos (azul)
- `#FFD93D` - Cor dos pontos próximos (amarelo)

### Ícones do Personagem

Altere o emoji 🧑‍🚀 em `InteractiveMap.tsx` na função `PlayerMarker`:
```typescript
🧑‍🚀  // Mude para outro emoji, ex: 👨, 👩, 🤖, etc
```

## 🏆 Adicionar Novas Medalhas

1. Abra `data/touristicPoints.ts`

2. Adicione uma nova medalha à array `availableBadges`:

```typescript
{
  id: "seu-badge-id",
  name: "Nome da Medalha",
  description: "Descrição de como desbloquear",
  icon: "🎖️",
}
```

3. Adicione a lógica de desbloqueio em `components/InteractiveMap.tsx`:

```typescript
// Exemplo: desbloquear quando visitar 3 pontos
if (visitedPoints.size === 3) {
  if (onBadgeUnlocked) {
    onBadgeUnlocked('seu-badge-id');
  }
}
```

## ⚙️ Ajustar Sensibilidade do Movimento

Em `components/InteractiveMap.tsx`, encontre:

```typescript
const INTERACTION_DISTANCE = 0.005; // Distância para interagir (menor = menos sensível)
const MOVEMENT_SPEED = 0.0005;      // Velocidade do movimento (maior = mais rápido)
```

Valores sugeridos:
- Mais fácil: `MOVEMENT_SPEED = 0.001`
- Mais difícil: `MOVEMENT_SPEED = 0.0002`
- Interação perto: `INTERACTION_DISTANCE = 0.002`
- Interação longe: `INTERACTION_DISTANCE = 0.01`

## 🌍 Mudar a Localização do Mapa

Em `components/InteractiveMap.tsx`, altere as coordenadas padrão:

```typescript
const [playerPosition, setPlayerPosition] = useState<PlayerPosition>({
  lat: -4.9667,  // Latitude
  lng: -42.4667, // Longitude
});
```

E no `MapContainer`:
```typescript
<MapContainer
  center={[playerPosition.lat, playerPosition.lng]}
  zoom={17}  // Zoom level (15-19 é bom para cidades)
  style={{ width: '100%', height: '100%' }}
  ref={mapRef}
>
```

## 🎵 Adicionar Áudio

1. Adicione as URLs de áudio aos pontos turísticos:

```typescript
{
  // ... outros campos
  audioUrl: "https://link-para-audio.mp3",
}
```

2. Crie um hook para tocar áudio:

```typescript
const playAudio = (url: string) => {
  const audio = new Audio(url);
  audio.play();
};
```

3. Use em `InteractiveMap.tsx` quando visitar um ponto:

```typescript
const handlePointVisited = useCallback((point: TouristicPoint) => {
  if (point.audioUrl) {
    playAudio(point.audioUrl);
  }
}, []);
```

## 📱 Adaptar para Mobile

Para melhor experiência em mobile, em `explore.tsx`:

1. Adicione botões na tela:
```typescript
<TouchableOpacity onPress={() => movePlayer('up')}>
  <Text>↑</Text>
</TouchableOpacity>
```

2. Ou use o acelerômetro do dispositivo (com expo-sensors)

## 🐛 Debugging

Use o React Native Debugger para:
- `console.log()` - Ver logs
- `console.warn()` - Ver avisos
- `console.error()` - Ver erros

Para ver os logs:
```bash
npx expo start
# Pressione Shift+M para abrir o menu do Metro
# Escolha "Show logs"
```

## 📚 Estrutura de Arquivos Importante

```
jogo-turismo-oeiras/
├── app/
│   ├── data/
│   │   └── touristicPoints.ts      ← Edite aqui para adicionar pontos
│   └── (tabs)/
│       └── explore.tsx              ← Tela principal
├── components/
│   ├── InteractiveMap.tsx           ← Mapa e movimento
│   └── BadgesDisplay.tsx            ← Medalhas
└── constants/
    └── theme.ts                     ← Cores e temas
```

## 🚀 Deploy

### Web
```bash
npm run build
npm run web
```

### Mobile
Use Expo Go ou crie um APK/IPA com EAS Build:
```bash
eas build --platform android
eas build --platform ios
```

## 💡 Dicas

1. **Performance**: Se o mapa ficar lento, aumente o zoom inicial
2. **Coordenadas**: Use o OpenStreetMap para coordenadas precisas
3. **Ícones**: Escolha emojis claros e legíveis
4. **Testes**: Sempre teste em web antes de mobile

## ❓ Problemas Comuns

### O mapa não carrega
- Verifique a conexão com internet
- Verifique se as coordenadas estão corretas
- Tente limpar cache: `npx expo start -c`

### O personagem não se move
- Verifique se a página está em foco
- Tente pressionar WASD ou Setas
- Verifique o console para erros

### Medalhas não desbloqueiam
- Verifique o id da medalha
- Confirme que a condição é acionada
- Use `console.log()` para debug
# Ativar o passeio Street View

O modo de jogo em primeira pessoa usa a **Google Maps JavaScript API** para mostrar
as ruas reais e permitir movimento somente entre panoramas conectados.

1. No Google Cloud, habilite a **Maps JavaScript API** em um projeto com faturamento ativo.
2. Crie uma chave de API e restrinja-a aos dominios em que o jogo sera executado.
3. Crie o arquivo `.env.local` na raiz do projeto:

```env
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=sua_chave_aqui
```

4. Reinicie o projeto:

```bash
npx expo start --web -c
```

No jogo, use `W`/seta para cima para andar pela rua, `S`/seta para baixo para
retornar e `A`/`D` ou setas laterais para virar a camera.
