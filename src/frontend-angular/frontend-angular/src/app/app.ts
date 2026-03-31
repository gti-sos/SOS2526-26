import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TaskListComponent } from './components/task-list/task-list';
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [TaskListComponent], // <--- QUITAMOS RouterOutlet y PONEMOS el tuyo
  templateUrl: './app.html',
  styleUrl: './app.css' // Asegúrate que este nombre también sea el corto
})
export class App { // O export class AppComponent
  title = 'frontend-angular';
}