import "dotenv/config";
import { PgClient } from "@effect/sql-pg";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import { types } from "pg";

type PlanRow = {
  readonly id: number;
  readonly calories: number;
  readonly fatsRatio: number;
  readonly carbohydratesRatio: number;
  readonly proteinsRatio: number;
};

type ServingRow = {
  readonly id: number;
  readonly meal: "breakfast" | "lunch" | "dinner" | "snacks";
  readonly quantity: number;
  readonly name: string;
  readonly calories: number;
  readonly fats: number;
  readonly carbohydrates: number;
  readonly proteins: number;
};

// Configure the PgClient layer with type parsers
const PgClientLive = PgClient.layer({
  url: Redacted.make(process.env.DATABASE_URL!),
  types: {
    getTypeParser: (typeId, format) => {
      // Return raw values for date/time types to let Drizzle handle parsing
      if (
        [1184, 1114, 1082, 1186, 1231, 1115, 1185, 1187, 1182].includes(typeId)
      ) {
        return (val: any) => val;
      }
      return types.getTypeParser(typeId, format);
    },
  },
});

const program = Effect.gen(function* () {
  const sql = yield* PgClient.PgClient;
  const today = new Date().toISOString().slice(0, 10);
  const plans = yield* sql<PlanRow>`
    select
      id,
      calories,
      "fatsRatio",
      "carbohydratesRatio",
      "proteinsRatio"
    from plan
    where "isCurrent" = true
    order by id desc
    limit 1
  `;
  const plan = plans[0];

  if (!plan) {
    yield* Effect.log("No current plan found. Create a plan before logging meals.");
    return;
  }

  yield* sql`
    insert into daily_log (date, plan_id)
    values (${today}, ${plan.id})
    on conflict (date) do nothing
  `;

  const servings = yield* sql<ServingRow>`
    select
      serving.id,
      serving.meal,
      serving.quantity,
      food.name,
      food.calories,
      food.fats,
      food.carbohydrates,
      food.proteins
    from serving
    inner join food on food.id = serving.food_id
    where serving.daily_log_date = ${today}
    order by serving.id asc
  `;
  const totals = servings.reduce(
    (acc, serving) => ({
      calories: acc.calories + (serving.calories / 100) * serving.quantity,
      fats: acc.fats + (serving.fats / 100) * serving.quantity,
      carbohydrates:
        acc.carbohydrates + (serving.carbohydrates / 100) * serving.quantity,
      proteins: acc.proteins + (serving.proteins / 100) * serving.quantity,
    }),
    { calories: 0, fats: 0, carbohydrates: 0, proteins: 0 },
  );

  yield* Effect.log(
    `Today: ${Math.round(totals.calories)} / ${plan.calories} kcal, ` +
      `${Math.round(totals.carbohydrates)}g carbs, ` +
      `${Math.round(totals.proteins)}g protein, ` +
      `${Math.round(totals.fats)}g fats`,
  );
});

// Run the program with the PgClient layer
Effect.runPromise(program.pipe(Effect.provide(PgClientLive)));
