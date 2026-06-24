import type { Movie } from './types';

export const SERVICES = [
  'Netflix', 'Prime Video', 'Max', 'Disney+', 'Globoplay',
  'Apple TV+', 'Paramount+', 'Pluto TV', 'YouTube',
];

export const POOL = [
  { n: 'Cidade de Deus', t: 'Filme' },
  { n: 'Tropa de Elite', t: 'Filme' },
  { n: 'Pulp Fiction', t: 'Filme' },
  { n: 'Interestelar', t: 'Filme' },
  { n: 'Parasita', t: 'Filme' },
  { n: 'Bacurau', t: 'Filme' },
  { n: 'O Senhor dos Anéis', t: 'Filme' },
  { n: 'Vingadores', t: 'Filme' },
  { n: 'Clube da Luta', t: 'Filme' },
  { n: 'Matrix', t: 'Filme' },
  { n: 'Coringa', t: 'Filme' },
  { n: 'Whiplash', t: 'Filme' },
  { n: 'O Auto da Compadecida', t: 'Filme' },
  { n: 'Central do Brasil', t: 'Filme' },
  { n: 'A Origem', t: 'Filme' },
  { n: 'Que Horas Ela Volta?', t: 'Filme' },
  { n: 'Ainda Estou Aqui', t: 'Filme' },
  { n: 'Titanic', t: 'Filme' },
  { n: 'Toy Story', t: 'Filme' },
  { n: 'Harry Potter', t: 'Filme' },
  { n: 'Quentin Tarantino', t: 'Diretor' },
  { n: 'Christopher Nolan', t: 'Diretor' },
  { n: 'Fernando Meirelles', t: 'Diretor' },
  { n: 'Wes Anderson', t: 'Diretor' },
  { n: 'Jordan Peele', t: 'Diretor' },
  { n: 'Walter Salles', t: 'Diretor' },
  { n: 'Kleber Mendonça Filho', t: 'Diretor' },
  { n: 'Greta Gerwig', t: 'Diretora' },
  { n: 'Martin Scorsese', t: 'Diretor' },
  { n: 'Steven Spielberg', t: 'Diretor' },
  { n: 'Wagner Moura', t: 'Ator' },
  { n: 'Fernanda Montenegro', t: 'Atriz' },
  { n: 'Leonardo DiCaprio', t: 'Ator' },
  { n: 'Denzel Washington', t: 'Ator' },
  { n: 'Selton Mello', t: 'Ator' },
  { n: 'Margot Robbie', t: 'Atriz' },
];

export const GRAD: [string, string][] = [
  ['#9A7CFF', '#FF5C9A'],
  ['#FFB13C', '#FF5C9A'],
  ['#6FD6C9', '#9A7CFF'],
  ['#FF7A59', '#9A7CFF'],
  ['#5BC0EB', '#9A7CFF'],
  ['#F0628A', '#FFB13C'],
];

export const GENRE_EMOJI: Record<string, string> = {
  Ação: '💥', Terror: '🔪', Comédia: '😄', Drama: '🎭',
  Ficção: '🛸', Romance: '❤️', Suspense: '🩸', Animação: '✨',
  Documentário: '🎞️', Aventura: '🧭',
};

export const MOODCOLORS: Record<string, [string, string]> = {
  cansado: ['#1b2436', '#3a3550'],
  agitado: ['#2a1b36', '#542f3f'],
  entediado: ['#162a2e', '#2f5246'],
  pra_baixo: ['#1a2230', '#445a6e'],
  tranquilo: ['#1e2a22', '#4a6b52'],
  ligado: ['#2e1414', '#6b2f2f'],
};

export const OPPOSITE: Record<string, string> = {
  cansado: 'ligado', agitado: 'ligado', entediado: 'tranquilo',
  pra_baixo: 'ligado', tranquilo: 'ligado', ligado: 'tranquilo',
};

export const FALLBACK: Record<string, Movie[]> = {
  cansado: [
    { titulo: 'O Grande Hotel Budapeste', ano: 2014, genero: 'Comédia', duracao: '1h 39min', tagline: 'um conto de fadas para gente grande', porque: 'Leve, lindo e fácil quando a cabeça já está cheia.', onde_assistir: 'Disney+', no_seu_streaming: true, cor1: '#3a1f33', cor2: '#a8607a' },
    { titulo: 'Ratatouille', ano: 2007, genero: 'Animação', duracao: '1h 51min', tagline: 'qualquer um pode cozinhar', porque: 'Aconchegante e sem peso nenhum pra relaxar.', onde_assistir: 'Disney+', no_seu_streaming: true, cor1: '#2e1d10', cor2: '#9a5a2a' },
    { titulo: 'Simplesmente Amor', ano: 2003, genero: 'Romance', duracao: '2h 15min', tagline: 'o amor está em toda parte', porque: 'Quentinho e leve, ideal pra desligar.', onde_assistir: 'verifique a disponibilidade', no_seu_streaming: false, cor1: '#2a1622', cor2: '#7a3a52' },
  ],
  agitado: [
    { titulo: 'Paterson', ano: 2016, genero: 'Drama', duracao: '1h 58min', tagline: 'a poesia nos dias iguais', porque: 'Calmo e contemplativo pra desacelerar de verdade.', onde_assistir: 'verifique a disponibilidade', no_seu_streaming: false, cor1: '#16202e', cor2: '#3d5a72' },
    { titulo: 'Comer, Rezar, Amar', ano: 2010, genero: 'Drama', duracao: '2h 13min', tagline: 'reencontrar o próprio eixo', porque: 'Convida a respirar e contemplar.', onde_assistir: 'verifique a disponibilidade', no_seu_streaming: false, cor1: '#22201a', cor2: '#6e5e3a' },
  ],
  entediado: [
    { titulo: 'Enola Holmes', ano: 2020, genero: 'Aventura', duracao: '2h 03min', tagline: 'o jogo começou', porque: 'Esperto e ágil pra acordar o interesse.', onde_assistir: 'Netflix', no_seu_streaming: true, cor1: '#16242a', cor2: '#3a6670' },
    { titulo: 'Truque de Mestre', ano: 2013, genero: 'Suspense', duracao: '1h 55min', tagline: 'olhe mais de perto', porque: 'Cheio de reviravoltas pra te prender.', onde_assistir: 'verifique a disponibilidade', no_seu_streaming: false, cor1: '#1a1430', cor2: '#4a3a7a' },
  ],
  pra_baixo: [
    { titulo: 'A Vida é Bela', ano: 1997, genero: 'Drama', duracao: '1h 56min', tagline: 'amor mais forte que tudo', porque: 'Toca fundo e ainda levanta o coração no fim.', onde_assistir: 'verifique a disponibilidade', no_seu_streaming: false, cor1: '#1f2810', cor2: '#6b7a3a' },
    { titulo: 'Up: Altas Aventuras', ano: 2009, genero: 'Animação', duracao: '1h 36min', tagline: 'aventura lá em cima', porque: 'Emociona e reanima ao mesmo tempo.', onde_assistir: 'Disney+', no_seu_streaming: true, cor1: '#16242e', cor2: '#3a7080' },
    { titulo: 'Pequena Miss Sunshine', ano: 2006, genero: 'Comédia', duracao: '1h 41min', tagline: 'siga em frente', porque: 'Doce-amarga, daquelas que confortam.', onde_assistir: 'verifique a disponibilidade', no_seu_streaming: false, cor1: '#2a2410', cor2: '#8a7a2a' },
  ],
  tranquilo: [
    { titulo: 'A Chegada', ano: 2016, genero: 'Ficção', duracao: '1h 56min', tagline: 'o tempo não é o que parece', porque: 'Bonito e reflexivo, perfeito quando você está aberto.', onde_assistir: 'verifique a disponibilidade', no_seu_streaming: false, cor1: '#16242e', cor2: '#3a6b72' },
    { titulo: 'Amélie Poulain', ano: 2001, genero: 'Romance', duracao: '2h 02min', tagline: 'pequenos prazeres', porque: 'Encantador e leve, do tipo que aquece.', onde_assistir: 'verifique a disponibilidade', no_seu_streaming: false, cor1: '#1f2410', cor2: '#6a7a2a' },
  ],
  ligado: [
    { titulo: 'Mad Max: Estrada da Fúria', ano: 2015, genero: 'Ação', duracao: '2h', tagline: 'que dia lindo', porque: 'Adrenalina pura pra quem topa intensidade.', onde_assistir: 'Max', no_seu_streaming: true, cor1: '#2e1606', cor2: '#c0701a' },
    { titulo: 'John Wick', ano: 2014, genero: 'Ação', duracao: '1h 41min', tagline: 'não mexa com ele', porque: 'Visceral e sem freio do início ao fim.', onde_assistir: 'verifique a disponibilidade', no_seu_streaming: false, cor1: '#1a1620', cor2: '#5a2a3a' },
    { titulo: 'Corra!', ano: 2017, genero: 'Terror', duracao: '1h 44min', tagline: 'fique atento', porque: 'Tenso e afiado pra quem quer pegar pesado.', onde_assistir: 'verifique a disponibilidade', no_seu_streaming: false, cor1: '#16201a', cor2: '#3a6648' },
  ],
};