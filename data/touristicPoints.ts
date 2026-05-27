export interface TouristicPoint {
  id: string;
  name: string;
  description: string;
  coordinates: [number, number]; // [latitude, longitude]
  icon: string;
  photos: string[];
  audioUrl?: string;
  visitedSound?: string;
  facts: string[];
}

// Pontos do centro de Oeiras, Piauí, baseados em dados do OpenStreetMap.
export const touristicPoints: TouristicPoint[] = [
  {
    id: "igreja-matriz",
    name: "Catedral Nossa Senhora da Vitória",
    description: "Templo histórico no coração de Oeiras, antiga capital do Piauí.",
    coordinates: [-7.0171809, -42.1310908],
    icon: "⛪",
    photos: [
      "https://via.placeholder.com/400x300?text=Igreja+Matriz",
    ],
    facts: [
      "É dedicada a Nossa Senhora da Vitória",
      "Fica junto à Praça das Vitórias",
      "É um dos símbolos religiosos da cidade",
    ],
  },
  {
    id: "praca-vitorias",
    name: "Praça das Vitórias",
    description: "Praça central onde se concentram importantes marcos históricos de Oeiras.",
    coordinates: [-7.0174049, -42.1311325],
    icon: "🏞️",
    photos: [
      "https://via.placeholder.com/400x300?text=Praça+Pública",
    ],
    facts: [
      "Ponto tradicional de encontro",
      "Reúne manifestações culturais",
      "Está ao lado da Catedral",
    ],
  },
  {
    id: "museu-arte-sacra",
    name: "Museu de Arte Sacra",
    description: "Espaço cultural voltado à memória religiosa e histórica de Oeiras.",
    coordinates: [-7.0166596, -42.1307076],
    icon: "🏛️",
    photos: [
      "https://via.placeholder.com/400x300?text=Biblioteca+Municipal",
    ],
    facts: [
      "Integra o circuito cultural do centro",
      "Valoriza a arte sacra local",
      "Fica próximo à Praça das Vitórias",
    ],
  },
  {
    id: "cine-teatro",
    name: "Cine Teatro",
    description: "Equipamento cultural situado na Praça das Bandeiras, no centro da cidade.",
    coordinates: [-7.0173829, -42.1305],
    icon: "🎭",
    photos: [
      "https://via.placeholder.com/400x300?text=Rio+Oeiras",
    ],
    facts: [
      "Espaço ligado à vida cultural da cidade",
      "Está na Praça das Bandeiras",
      "Faz parte do roteiro histórico central",
    ],
  },
  {
    id: "prefeitura",
    name: "Prefeitura Municipal",
    description: "Sede da administração municipal de Oeiras.",
    coordinates: [-7.0168239, -42.1317878],
    icon: "🏛️",
    photos: [
      "https://via.placeholder.com/400x300?text=Prefeitura+Municipal",
    ],
    facts: [
      "Centro administrativo",
      "Arquitetura tradicional",
      "Atende à comunidade desde o século XIX",
    ],
  },
  {
    id: "mercado-dona-lili",
    name: "Mercado Municipal Dona Lili",
    description: "Mercado local que reúne produtos e atividades comerciais da cidade.",
    coordinates: [-7.0142138, -42.134],
    icon: "🛒",
    photos: [
      "https://via.placeholder.com/400x300?text=Mercado+Público",
    ],
    facts: [
      "Comércio local tradicional",
      "Produtos regionais",
      "Parte da cultura mercantil de Oeiras",
    ],
  },
];

// Tipos para sistema de medalhas
export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt?: Date;
}

export const availableBadges: Badge[] = [
  {
    id: "explorer",
    name: "Explorador",
    description: "Visitou todos os pontos turísticos de Oeiras",
    icon: "🗺️",
  },
  {
    id: "history_buff",
    name: "Apaixonado por História",
    description: "Aprendeu sobre a história de Oeiras",
    icon: "📖",
  },
  {
    id: "first_step",
    name: "Primeiro Passo",
    description: "Visitou o primeiro ponto turístico",
    icon: "👣",
  },
  {
    id: "culture_lover",
    name: "Amante da Cultura",
    description: "Visitou todos os pontos culturais",
    icon: "🎭",
  },
];
