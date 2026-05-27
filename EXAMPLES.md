# 📚 Exemplos de Customização

## Exemplo 1: Adicionar um novo Ponto Turístico

### Passo 1: Encontre as coordenadas no OpenStreetMap
1. Acesse https://www.openstreetmap.org
2. Procure "Oeiras, Piauí"
3. Clique no local que quer adicionar
4. As coordenadas aparecem na URL

### Passo 2: Adicione ao arquivo `data/touristicPoints.ts`

```typescript
{
  id: "museu-oeiras",
  name: "Museu de Oeiras",
  description: "Museu com acervo de arte e cultura local de Oeiras, mostrando a história da cidade através de exposições permanentes e temporárias.",
  coordinates: [-4.9670, -42.4670], // Exemplo de coordenadas
  icon: "🎨",
  photos: [
    "https://via.placeholder.com/400x300?text=Museu+de+Oeiras",
  ],
  facts: [
    "Fundado em 1990",
    "Mais de 500 peças no acervo",
    "Realiza exposições temporárias mensais",
  ],
}
```

## Exemplo 2: Criar uma Nova Medalha

Adicione à array `availableBadges`:

```typescript
{
  id: "art_lover",
  name: "Amante das Artes",
  description: "Visitou o Museu de Oeiras",
  icon: "🎨",
}
```

## Exemplo 3: Adicionar Lógica para Desbloquear Medalha

Em `components/InteractiveMap.tsx`, adicione dentro do `useEffect` que verifica proximidade:

```typescript
// Desbloquear medalha ao visitar o museu
if (point.id === "museu-oeiras" && !visitedPoints.has("museu-oeiras")) {
  if (onBadgeUnlocked) {
    onBadgeUnlocked('art_lover');
  }
}
```

## Exemplo 4: Pontos Turísticos Reais de Oeiras

Aqui estão alguns pontos reais que poderiam ser adicionados:

```typescript
// Centro Histórico de Oeiras
{
  id: "centro-historico",
  name: "Centro Histórico de Oeiras",
  description: "O coração histórico da cidade com ruas coloniais e arquitetura antiga.",
  coordinates: [-4.9667, -42.4667],
  icon: "🏛️",
  photos: ["https://via.placeholder.com/400x300?text=Centro+Histórico"],
  facts: [
    "Fundação data de 1658",
    "Preserva arquitetura colonial",
    "Ruas empedradas tradicionais",
  ],
}

// Ponte Histórica
{
  id: "ponte-historica",
  name: "Ponte Histórica de Oeiras",
  description: "Ponte antiga que conecta os dois lados da cidade.",
  coordinates: [-4.9680, -42.4680],
  icon: "🌉",
  photos: ["https://via.placeholder.com/400x300?text=Ponte+Histórica"],
  facts: [
    "Construída no século XVIII",
    "Estrutura de pedra e madeira",
    "Ponto importante de comércio histórico",
  ],
}

// Mercado Tradicional
{
  id: "mercado-tradicional",
  name: "Mercado de Produtos Locais",
  description: "Mercado que vende produtos típicos da região.",
  coordinates: [-4.9673, -42.4673],
  icon: "🥒",
  photos: ["https://via.placeholder.com/400x300?text=Mercado+Local"],
  facts: [
    "Produtos orgânicos da região",
    "Funciona desde 1920",
    "Principal ponto de vendas locais",
  ],
}
```

## Exemplo 5: Customizar Cores do Tema

Em `components/InteractiveMap.tsx`, mude as cores:

```typescript
// Mudar para um tema mais "neon"
const playerIcon = L.divIcon({
  html: `
    <div style="
      background-color: #00FF00;  // Verde neon
      border: 3px solid #0FF;     // Azul neon
      ...
    ">
```

## Exemplo 6: Adicionar Sistema de Pontuação com Níveis

Crie um novo hook em `components/`:

```typescript
// hooks/useGameStats.ts
export const useGameStats = () => {
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);

  const addScore = (points: number) => {
    setScore(prev => {
      const newScore = prev + points;
      // Level up a cada 100 pontos
      setLevel(Math.floor(newScore / 100) + 1);
      return newScore;
    });
  };

  return { score, level, addScore };
};
```

## Exemplo 7: Adicionar Ponto com Áudio

```typescript
{
  id: "catedral-musica",
  name: "Catedral da Música",
  description: "Espaço dedicado à música clássica.",
  coordinates: [-4.9665, -42.4665],
  icon: "🎵",
  photos: ["https://via.placeholder.com/400x300?text=Catedral+da+Música"],
  audioUrl: "https://exemplo.com/musica-classica.mp3",
  facts: [
    "Realiza concertos mensais",
    "Acústica perfeita",
    "Aberta ao público",
  ],
}
```

## Exemplo 8: Aumentar Dificuldade

Em `components/InteractiveMap.tsx`:

```typescript
// Modo Difícil - movimento mais lento
const MOVEMENT_SPEED_EASY = 0.001;
const MOVEMENT_SPEED_HARD = 0.0002;

// Modo Fácil - mais fácil interagir
const INTERACTION_DISTANCE_EASY = 0.01;
const INTERACTION_DISTANCE_HARD = 0.002;

// Use baseado em um prop
interface InteractiveMapProps {
  difficulty?: 'easy' | 'normal' | 'hard';
}

const difficulty = props.difficulty || 'normal';
const MOVEMENT_SPEED = 
  difficulty === 'easy' ? MOVEMENT_SPEED_EASY :
  difficulty === 'hard' ? MOVEMENT_SPEED_HARD :
  0.0005;
```

## Exemplo 9: Sistema de Leaderboard

Adicione em `components/`:

```typescript
interface PlayerStats {
  name: string;
  score: number;
  pointsVisited: number;
  badgesUnlocked: number;
}

export const useLeaderboard = () => {
  const [players, setPlayers] = useState<PlayerStats[]>([]);

  const submitScore = (player: PlayerStats) => {
    setPlayers(prev => 
      [...prev, player]
        .sort((a, b) => b.score - a.score)
        .slice(0, 10) // Top 10
    );
  };

  return { players, submitScore };
};
```

## Exemplo 10: Modo Multijogador Local

```typescript
interface Player {
  id: string;
  name: string;
  position: PlayerPosition;
  color: string;
}

// Em InteractiveMap.tsx
{players.map(player => (
  <PlayerMarker key={player.id} position={player.position} color={player.color} />
))}
```

---

Para mais exemplos, consulte os arquivos:
- `CUSTOMIZE.md` - Guia completo
- `README.md` - Documentação geral
- `data/touristicPoints.ts` - Estrutura de dados
