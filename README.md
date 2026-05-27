# 🎮 Jogo de Turismo de Oeiras - Piauí

Um site/aplicativo interativo que combina mapa real com jogo 2D! Explore os pontos turísticos de Oeiras caminhando com um personagem pelo mapa da cidade como se fosse um jogo.

## 🎯 Recursos Principais

- 🗺️ **Mapa Interativo**: Mapa em tempo real de Oeiras usando OpenStreetMap
- 🧑‍🚀 **Personagem Controlável**: Controle um personagem que caminha pelas ruas reais
- 📍 **Pontos Turísticos**: 6+ pontos turísticos com informações detalhadas
- 🏆 **Sistema de Medalhas**: Desbloqueie medalhas ao explorar
- 📱 **Responsivo**: Funciona em web, Android e iOS
- ⌨️ **Controles Simples**: WASD ou Setas para mover

## 🛠️ Instalação

1. **Instalar dependências**
```bash
npm install
```

2. **Iniciar o desenvolvimento**
```bash
npm start
```

Para abrir em diferentes plataformas:
- Web: Pressione `w` no terminal
- Android: Pressione `a` no terminal
- iOS: Pressione `i` no terminal

## 🎮 Como Jogar

1. Abra a tela "Explore"
2. Use os controles para mover seu personagem:
   - **W** ou **↑**: Mover para cima
   - **A** ou **←**: Mover para esquerda
   - **S** ou **↓**: Mover para baixo
   - **D** ou **→**: Mover para direita

3. Aproxime-se dos pontos turísticos (ícones coloridos)
4. Clique nos pontos para ver informações
5. Colete medalhas explorando todos os locais

## 📍 Pontos Turísticos de Oeiras

- ⛪ Igreja Matriz de Oeiras
- 🏞️ Praça Pública de Oeiras
- 📚 Biblioteca Municipal
- 💧 Rio Oeiras
- 🏛️ Prefeitura Municipal
- 🛒 Mercado Público

## 🏆 Sistema de Medalhas

Desbloqueie medalhas por:
- 👣 Primeiro Passo: Visite o primeiro ponto turístico
- 🗺️ Explorador: Visite todos os pontos turísticos
- 📖 Apaixonado por História: Aprenda sobre a história de Oeiras
- 🎭 Amante da Cultura: Visite todos os pontos culturais

## 📦 Tecnologias Utilizadas

- **React Native**: Framework para desenvolvimento multi-plataforma
- **Expo**: Plataforma para React Native
- **Leaflet.js**: Biblioteca de mapas interativos
- **React Leaflet**: Componentes React para Leaflet
- **OpenStreetMap**: Dados de mapa gratuitos
- **TypeScript**: Tipagem estática
- **React Native Reanimated**: Animações fluidas

## 🎨 Estrutura do Projeto

```
jogo-turismo-oeiras/
├── app/
│   ├── (tabs)/
│   │   ├── explore.tsx          # Tela principal do jogo
│   │   ├── index.tsx            # Home
│   │   └── _layout.tsx
│   ├── data/
│   │   └── touristicPoints.ts   # Dados dos pontos turísticos
│   ├── _layout.tsx
│   └── globals.css
├── components/
│   ├── InteractiveMap.tsx       # Componente do mapa
│   └── BadgesDisplay.tsx        # Sistema de medalhas
├── constants/
├── hooks/
└── package.json
```

## 🚀 Próximas Melhorias

- [ ] Adicionar áudio ao visitar pontos turísticos
- [ ] Sistema de fotos antigas dos pontos turísticos
- [ ] Mais pontos turísticos
- [ ] Temas diferentes para o mapa
- [ ] Sistema de ranking
- [ ] Modo multiplayer
- [ ] Histórias interativas em cada ponto

## 📝 Licença

MIT

## 👨‍💻 Desenvolvedor

Criado com ❤️ para a cidade de Oeiras, Piauí

