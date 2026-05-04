import './style.css'

type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snacks'

type Food = {
  readonly id: number
  readonly name: string
  readonly brand: string | null
  readonly calories: number
  readonly fats: number
  readonly carbohydrates: number
  readonly proteins: number
}

type Serving = {
  readonly id: number
  readonly foodId: number
  readonly meal: Meal
  readonly quantity: number
}

type Plan = {
  readonly calories: number
  readonly fatsRatio: number
  readonly carbohydratesRatio: number
  readonly proteinsRatio: number
}

type AppState = {
  readonly selectedDate: string
  readonly plan: Plan
  readonly foods: readonly Food[]
  readonly servings: readonly Serving[]
}

type ServingWithFood = Serving & {
  readonly food: Food
}

const meals: readonly Meal[] = ['breakfast', 'lunch', 'dinner', 'snacks']

const mealLabels: Record<Meal, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snacks: 'Snacks',
}

const storageKey = 'local-app:nutrition-log'

const today = new Date().toISOString().slice(0, 10)

let state: AppState = loadState()

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('App root not found')
}

const appRoot = app

render()

function loadState(): AppState {
  const stored = localStorage.getItem(storageKey)

  if (stored) {
    return JSON.parse(stored) as AppState
  }

  return {
    selectedDate: today,
    plan: {
      calories: 2200,
      fatsRatio: 30,
      carbohydratesRatio: 40,
      proteinsRatio: 30,
    },
    foods: [
      {
        id: 1,
        name: 'Greek yogurt',
        brand: 'Kitchen',
        calories: 59,
        fats: 0.4,
        carbohydrates: 3.6,
        proteins: 10,
      },
      {
        id: 2,
        name: 'Brown rice',
        brand: 'Pantry',
        calories: 123,
        fats: 1,
        carbohydrates: 25.6,
        proteins: 2.7,
      },
      {
        id: 3,
        name: 'Grilled chicken breast',
        brand: 'Kitchen',
        calories: 165,
        fats: 3.6,
        carbohydrates: 0,
        proteins: 31,
      },
    ],
    servings: [
      { id: 1, foodId: 1, meal: 'breakfast', quantity: 250 },
      { id: 2, foodId: 2, meal: 'lunch', quantity: 180 },
      { id: 3, foodId: 3, meal: 'lunch', quantity: 160 },
    ],
  }
}

function saveState(nextState: AppState): void {
  state = nextState
  localStorage.setItem(storageKey, JSON.stringify(state))
  render()
}

function render(): void {
  const servings = getServingsWithFood(state)
  const totals = calculateTotals(servings)
  const calorieProgress = clamp((totals.calories / state.plan.calories) * 100)
  const fatTarget = macroTarget('fats')
  const carbTarget = macroTarget('carbohydrates')
  const proteinTarget = macroTarget('proteins')

  appRoot.innerHTML = `
    <header class="app-header">
      <div>
        <p class="eyebrow">Daily log</p>
        <h1>Nutrition Planner</h1>
      </div>
      <label class="date-control">
        <span>Date</span>
        <input id="selected-date" type="date" value="${state.selectedDate}">
      </label>
    </header>

    <main class="app-shell">
      <section class="panel summary-panel" aria-label="Daily progress">
        <div class="summary-main">
          <span>${Math.round(totals.calories)}</span>
          <small>of ${state.plan.calories} kcal</small>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width: ${calorieProgress}%"></div>
        </div>
        <div class="macro-grid">
          ${macroTile('Carbs', totals.carbohydrates, carbTarget, 'g')}
          ${macroTile('Protein', totals.proteins, proteinTarget, 'g')}
          ${macroTile('Fats', totals.fats, fatTarget, 'g')}
        </div>
      </section>

      <section class="panel plan-panel" aria-label="Plan">
        <h2>Plan</h2>
        <form id="plan-form" class="plan-grid">
          ${numberField('Calories', 'calories', state.plan.calories, 0)}
          ${numberField('Carbs %', 'carbohydratesRatio', state.plan.carbohydratesRatio, 0)}
          ${numberField('Protein %', 'proteinsRatio', state.plan.proteinsRatio, 0)}
          ${numberField('Fats %', 'fatsRatio', state.plan.fatsRatio, 0)}
          <button type="submit">Save plan</button>
        </form>
      </section>

      <section class="panel meal-panel" aria-label="Meals">
        <div class="section-heading">
          <h2>Meals</h2>
          <form id="serving-form" class="inline-form">
            <select name="meal" aria-label="Meal">
              ${meals.map((meal) => `<option value="${meal}">${mealLabels[meal]}</option>`).join('')}
            </select>
            <select name="foodId" aria-label="Food">
              ${state.foods.map((food) => `<option value="${food.id}">${escapeHtml(food.name)}</option>`).join('')}
            </select>
            <input name="quantity" type="number" min="1" step="1" value="100" aria-label="Quantity in grams">
            <button type="submit">Add</button>
          </form>
        </div>
        <div class="meal-list">
          ${meals.map((meal) => mealSection(meal, servings)).join('')}
        </div>
      </section>

      <section class="panel food-panel" aria-label="Food catalog">
        <div class="section-heading">
          <h2>Foods</h2>
        </div>
        <form id="food-form" class="food-form">
          <input name="name" required placeholder="Food name" aria-label="Food name">
          <input name="brand" placeholder="Brand" aria-label="Brand">
          <input name="calories" required type="number" min="0" step="0.1" placeholder="kcal" aria-label="Calories per 100g">
          <input name="carbohydrates" required type="number" min="0" step="0.1" placeholder="Carbs" aria-label="Carbohydrates per 100g">
          <input name="proteins" required type="number" min="0" step="0.1" placeholder="Protein" aria-label="Protein per 100g">
          <input name="fats" required type="number" min="0" step="0.1" placeholder="Fats" aria-label="Fats per 100g">
          <button type="submit">Add food</button>
        </form>
        <div class="food-table">
          ${state.foods.map(foodRow).join('')}
        </div>
      </section>
    </main>
  `

  bindEvents()
}

function bindEvents(): void {
  document.querySelector<HTMLInputElement>('#selected-date')?.addEventListener('change', (event) => {
    const input = event.currentTarget as HTMLInputElement
    const selectedDate = input.value || today
    saveState({ ...state, selectedDate })
  })

  document.querySelector<HTMLFormElement>('#plan-form')?.addEventListener('submit', (event) => {
    event.preventDefault()
    const formElement = event.currentTarget as HTMLFormElement
    const form = new FormData(formElement)
    const plan = {
      calories: formNumber(form, 'calories'),
      carbohydratesRatio: formNumber(form, 'carbohydratesRatio'),
      proteinsRatio: formNumber(form, 'proteinsRatio'),
      fatsRatio: formNumber(form, 'fatsRatio'),
    }

    if (plan.carbohydratesRatio + plan.proteinsRatio + plan.fatsRatio !== 100) {
      window.alert('Macro ratios must add up to 100')
      return
    }

    saveState({ ...state, plan })
  })

  document.querySelector<HTMLFormElement>('#serving-form')?.addEventListener('submit', (event) => {
    event.preventDefault()
    const formElement = event.currentTarget as HTMLFormElement
    const form = new FormData(formElement)
    const nextServing: Serving = {
      id: nextId(state.servings),
      meal: form.get('meal') as Meal,
      foodId: formNumber(form, 'foodId'),
      quantity: formNumber(form, 'quantity'),
    }

    saveState({ ...state, servings: [...state.servings, nextServing] })
  })

  document.querySelector<HTMLFormElement>('#food-form')?.addEventListener('submit', (event) => {
    event.preventDefault()
    const formElement = event.currentTarget as HTMLFormElement
    const form = new FormData(formElement)
    const brand = formText(form, 'brand')
    const nextFood: Food = {
      id: nextId(state.foods),
      name: formText(form, 'name'),
      brand: brand.length > 0 ? brand : null,
      calories: formNumber(form, 'calories'),
      carbohydrates: formNumber(form, 'carbohydrates'),
      proteins: formNumber(form, 'proteins'),
      fats: formNumber(form, 'fats'),
    }

    saveState({ ...state, foods: [...state.foods, nextFood] })
  })

  document.querySelectorAll<HTMLButtonElement>('[data-remove-serving]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = Number(button.dataset.removeServing)
      saveState({
        ...state,
        servings: state.servings.filter((serving) => serving.id !== id),
      })
    })
  })
}

function mealSection(meal: Meal, servings: readonly ServingWithFood[]): string {
  const mealServings = servings.filter((serving) => serving.meal === meal)
  const calories = calculateTotals(mealServings).calories

  return `
    <article class="meal-group">
      <header>
        <h3>${mealLabels[meal]}</h3>
        <span>${Math.round(calories)} kcal</span>
      </header>
      <div class="servings">
        ${
          mealServings.length === 0
            ? '<p class="empty">No servings</p>'
            : mealServings.map(servingRow).join('')
        }
      </div>
    </article>
  `
}

function servingRow(serving: ServingWithFood): string {
  const calories = (serving.food.calories / 100) * serving.quantity

  return `
    <div class="serving-row">
      <div>
        <strong>${escapeHtml(serving.food.name)}</strong>
        <span>${serving.quantity}g · ${Math.round(calories)} kcal</span>
      </div>
      <button type="button" data-remove-serving="${serving.id}" aria-label="Remove ${escapeHtml(serving.food.name)}">Remove</button>
    </div>
  `
}

function foodRow(food: Food): string {
  return `
    <div class="food-row">
      <div>
        <strong>${escapeHtml(food.name)}</strong>
        <span>${escapeHtml(food.brand ?? 'Unbranded')}</span>
      </div>
      <span>${food.calories} kcal</span>
      <span>${food.carbohydrates}C</span>
      <span>${food.proteins}P</span>
      <span>${food.fats}F</span>
    </div>
  `
}

function macroTile(label: string, value: number, target: number, unit: string): string {
  return `
    <div class="macro-tile">
      <span>${label}</span>
      <strong>${Math.round(value)}${unit}</strong>
      <small>${Math.round(target)}${unit}</small>
    </div>
  `
}

function numberField(label: string, name: keyof Plan, value: number, min: number): string {
  return `
    <label>
      <span>${label}</span>
      <input name="${name}" type="number" min="${min}" step="1" value="${value}">
    </label>
  `
}

function getServingsWithFood(current: AppState): readonly ServingWithFood[] {
  return current.servings.flatMap((serving) => {
    const food = current.foods.find((item) => item.id === serving.foodId)
    return food ? [{ ...serving, food }] : []
  })
}

function calculateTotals(servings: readonly ServingWithFood[]) {
  return servings.reduce(
    (totals, serving) => ({
      calories: totals.calories + (serving.food.calories / 100) * serving.quantity,
      fats: totals.fats + (serving.food.fats / 100) * serving.quantity,
      carbohydrates:
        totals.carbohydrates + (serving.food.carbohydrates / 100) * serving.quantity,
      proteins: totals.proteins + (serving.food.proteins / 100) * serving.quantity,
    }),
    { calories: 0, fats: 0, carbohydrates: 0, proteins: 0 },
  )
}

function macroTarget(macro: 'fats' | 'carbohydrates' | 'proteins'): number {
  const caloriesPerGram = macro === 'fats' ? 9 : 4
  const ratioKey = `${macro === 'fats' ? 'fats' : macro}Ratio` as keyof Plan
  return (state.plan.calories * (state.plan[ratioKey] / 100)) / caloriesPerGram
}

function formNumber(form: FormData, key: string): number {
  return Number(form.get(key) ?? 0)
}

function formText(form: FormData, key: string): string {
  return String(form.get(key) ?? '').trim()
}

function nextId(items: readonly { readonly id: number }[]): number {
  return Math.max(0, ...items.map((item) => item.id)) + 1
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value))
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    }

    return entities[character] ?? character
  })
}
