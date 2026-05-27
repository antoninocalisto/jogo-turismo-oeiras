#!/usr/bin/env node

/**
 * Script de teste para o Jogo de Turismo de Oeiras
 * Execute com: node scripts/test-setup.js
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Verificando Setup do Projeto...\n');

const checks = [
  {
    name: 'package.json',
    path: 'package.json',
    required: true,
  },
  {
    name: 'Dados de Pontos Turísticos',
    path: 'data/touristicPoints.ts',
    required: true,
  },
  {
    name: 'Componente do Mapa',
    path: 'components/InteractiveMap.tsx',
    required: true,
  },
  {
    name: 'Sistema de Medalhas',
    path: 'components/BadgesDisplay.tsx',
    required: true,
  },
  {
    name: 'Tela Principal',
    path: 'app/(tabs)/explore.tsx',
    required: true,
  },
  {
    name: 'CSS Global',
    path: 'app/globals.css',
    required: true,
  },
  {
    name: 'README',
    path: 'README.md',
    required: false,
  },
  {
    name: 'Guia de Customização',
    path: 'CUSTOMIZE.md',
    required: false,
  },
];

let passedChecks = 0;
let failedChecks = 0;

checks.forEach(check => {
  const filePath = path.join(__dirname, '..', check.path);
  const exists = fs.existsSync(filePath);
  
  if (exists) {
    console.log(`✅ ${check.name} encontrado`);
    passedChecks++;
  } else if (check.required) {
    console.log(`❌ ${check.name} NÃO encontrado (REQUERIDO)`);
    failedChecks++;
  } else {
    console.log(`⚠️  ${check.name} não encontrado (opcional)`);
  }
});

console.log(`\n📊 Resultado: ${passedChecks} ✅, ${failedChecks} ❌`);

if (failedChecks === 0) {
  console.log('\n✨ Projeto configurado corretamente!');
  console.log('\n📖 Próximos passos:');
  console.log('1. Execute: npm start');
  console.log('2. Pressione: w (para abrir no navegador)');
  console.log('3. Use: WASD ou Setas para mover');
  process.exit(0);
} else {
  console.log('\n❌ Alguns arquivos estão faltando!');
  process.exit(1);
}
