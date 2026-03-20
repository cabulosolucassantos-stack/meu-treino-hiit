import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'home',
    loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
  {
    path: 'configuracao', // O endereço que vamos usar
    loadComponent: () => import('./configuracao/configuracao.page').then( m => m.ConfiguracaoPage)
  },
];
