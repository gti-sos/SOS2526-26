import { Injectable } from '@angular/core';
import { Task } from '../models/task.model';

@Injectable({
  providedIn: 'root'
})
export class TaskService {
  // Nuestra "base de datos" temporal
  private tasks: Task[] = [
    { id: 1, title: 'Aprender Angular', completed: false },
    { id: 2, title: 'Configurar el CRUD', completed: true }
  ];

  constructor() { }

  getTasks(): Task[] {
    return this.tasks;
  }

  addTask(task: Task) {
    this.tasks.push(task);
  }

  deleteTask(id: number) {
    this.tasks = this.tasks.filter(t => t.id !== id);
    return this.tasks;
  }

  toggleCompleted(id: number) {
    const task = this.tasks.find(t => t.id === id);
    if (task) {
      task.completed = !task.completed; // Si era true pasa a false, y al revés
    }
    return this.tasks;
  }
}