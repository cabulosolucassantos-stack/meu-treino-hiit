import { Component } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true, // ESSA LINHA É OBRIGATÓRIA
  imports: [IonicModule, CommonModule]
})
export class HomePage {
  public blocoAtual: number = 1;
  public roundAtual: number = 1;
  public tempo: number = 40;
  public fase: 'AÇÃO' | 'RECUPERAÇÃO' = 'AÇÃO';
  public timer: any;

  iniciarTreino() {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      if (this.tempo > 0) {
        this.tempo--;
      } else {
        this.trocarFase();
      }
    }, 1000);
  }

  trocarFase() {
    if (this.fase === 'AÇÃO') {
      this.fase = 'RECUPERAÇÃO';
      this.tempo = 20;
    } else {
      this.fase = 'AÇÃO';
      this.tempo = 40;
      this.roundAtual++;
      if (this.roundAtual > 4) {
        this.roundAtual = 1;
        this.blocoAtual++;
      }
    }
  }
}