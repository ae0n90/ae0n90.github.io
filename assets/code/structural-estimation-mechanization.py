"""Structural-estimation teaching example: mechanization-service adoption.

The script uses only Python's standard library. It generates synthetic data,
estimates a static logit model with Newton-Raphson, checks simple in-sample fit,
and saves a subsidy counterfactual. It is not an analysis of real farmers.
"""

from __future__ import annotations

import csv
import math
import random
from pathlib import Path
from typing import NamedTuple


SEED = 20260804
N_FARMERS = 700
TRUE_THETA = [-0.80, -1.40, 0.75, -0.18, 0.90]


class Farmer(NamedTuple):
    listed_price: float
    voucher: float
    net_price: float
    land: float
    log_land: float
    distance: float
    quality: float
    adopt: int


def logistic(value: float) -> float:
    """Compute a numerically stable logistic probability."""
    if value >= 0:
        return 1.0 / (1.0 + math.exp(-value))
    exp_value = math.exp(value)
    return exp_value / (1.0 + exp_value)


def dot(left: list[float], right: list[float]) -> float:
    return sum(x * y for x, y in zip(left, right, strict=True))


def features(farmer: Farmer, subsidy: float | None = None) -> list[float]:
    """Map one farmer into the utility index, optionally changing the subsidy."""
    price = (
        farmer.net_price
        if subsidy is None
        else farmer.listed_price * (1.0 - subsidy)
    )
    return [1.0, price, farmer.log_land, farmer.distance, farmer.quality]


def simulate_data(seed: int = SEED) -> list[Farmer]:
    """Generate the synthetic teaching sample with a randomized voucher."""
    rng = random.Random(seed)
    farmers: list[Farmer] = []
    for _ in range(N_FARMERS):
        listed_price = 0.8 + rng.random()
        voucher = 0.30 if rng.random() < 0.50 else 0.0
        net_price = listed_price * (1.0 - voucher)
        land = 0.3 + 2.7 * rng.random()
        log_land = math.log1p(land)
        distance = 0.5 + 6.0 * rng.random()
        quality = 0.3 + 0.7 * rng.random()
        x = [1.0, net_price, log_land, distance, quality]
        probability = logistic(dot(x, TRUE_THETA))
        adopt = int(rng.random() < probability)
        farmers.append(
            Farmer(
                listed_price,
                voucher,
                net_price,
                land,
                log_land,
                distance,
                quality,
                adopt,
            )
        )
    return farmers


def solve_linear_system(
    matrix: list[list[float]],
    vector: list[float],
) -> list[float]:
    """Solve A x = b by Gaussian elimination with partial pivoting."""
    size = len(vector)
    augmented = [row[:] + [value] for row, value in zip(matrix, vector, strict=True)]
    for column in range(size):
        pivot = max(range(column, size), key=lambda row: abs(augmented[row][column]))
        if abs(augmented[pivot][column]) < 1e-12:
            raise RuntimeError("Information matrix is singular; parameters are not identified.")
        augmented[column], augmented[pivot] = augmented[pivot], augmented[column]
        pivot_value = augmented[column][column]
        augmented[column] = [value / pivot_value for value in augmented[column]]
        for row in range(size):
            if row == column:
                continue
            factor = augmented[row][column]
            augmented[row] = [
                current - factor * pivot_current
                for current, pivot_current in zip(
                    augmented[row], augmented[column], strict=True
                )
            ]
    return [augmented[row][-1] for row in range(size)]


def inverse_matrix(matrix: list[list[float]]) -> list[list[float]]:
    """Invert a small matrix by solving against each unit vector."""
    size = len(matrix)
    columns = []
    for column in range(size):
        unit = [1.0 if row == column else 0.0 for row in range(size)]
        columns.append(solve_linear_system(matrix, unit))
    return [[columns[column][row] for column in range(size)] for row in range(size)]


def log_likelihood(theta: list[float], farmers: list[Farmer]) -> float:
    """Return the Bernoulli log likelihood at theta."""
    total = 0.0
    for farmer in farmers:
        index = dot(features(farmer), theta)
        total += farmer.adopt * index - max(index, 0.0) - math.log1p(
            math.exp(-abs(index))
        )
    return total


def score_and_information(
    theta: list[float],
    farmers: list[Farmer],
) -> tuple[list[float], list[list[float]]]:
    """Compute the logit score and observed information matrix."""
    size = len(theta)
    score = [0.0] * size
    information = [[0.0] * size for _ in range(size)]
    for farmer in farmers:
        x = features(farmer)
        probability = logistic(dot(x, theta))
        residual = farmer.adopt - probability
        weight = probability * (1.0 - probability)
        for row in range(size):
            score[row] += x[row] * residual
            for column in range(size):
                information[row][column] += weight * x[row] * x[column]
    return score, information


def estimate_logit(
    farmers: list[Farmer],
    tolerance: float = 1e-9,
    max_iterations: int = 100,
) -> tuple[list[float], list[float], int]:
    """Maximize the logit likelihood using Newton-Raphson scoring steps."""
    theta = [0.0] * len(TRUE_THETA)
    for iteration in range(1, max_iterations + 1):
        score, information = score_and_information(theta, farmers)
        step = solve_linear_system(information, score)
        theta = [value + change for value, change in zip(theta, step, strict=True)]
        if max(abs(change) for change in step) < tolerance:
            _, final_information = score_and_information(theta, farmers)
            covariance = inverse_matrix(final_information)
            standard_errors = [math.sqrt(covariance[index][index]) for index in range(len(theta))]
            return theta, standard_errors, iteration
    raise RuntimeError("Newton-Raphson did not converge within the iteration limit.")


def price_quartile_fit(theta: list[float], farmers: list[Farmer]) -> None:
    """Print observed and predicted adoption by net-price quartile."""
    ordered = sorted(farmers, key=lambda farmer: farmer.net_price)
    print("\nFit by net-price quartile")
    for group in range(4):
        start = group * len(ordered) // 4
        stop = (group + 1) * len(ordered) // 4
        sample = ordered[start:stop]
        observed = sum(farmer.adopt for farmer in sample) / len(sample)
        predicted = sum(logistic(dot(features(farmer), theta)) for farmer in sample) / len(sample)
        print(
            f"Q{group + 1}: observed={observed:.3f}, "
            f"predicted={predicted:.3f}, n={len(sample)}"
        )


def subsidy_counterfactual(
    theta: list[float],
    farmers: list[Farmer],
) -> list[tuple[float, float, float]]:
    """Hold supply fixed and predict adoption under universal subsidies."""
    rows: list[tuple[float, float, float]] = []
    for percentage in range(51):
        subsidy = percentage / 100.0
        probabilities = [
            logistic(dot(features(farmer, subsidy), theta)) for farmer in farmers
        ]
        adoption_rate = sum(probabilities) / len(probabilities)
        fiscal_cost = sum(
            probability * farmer.listed_price * subsidy
            for farmer, probability in zip(farmers, probabilities, strict=True)
        ) / len(farmers)
        rows.append((subsidy, adoption_rate, fiscal_cost))
    return rows


def save_counterfactual(rows: list[tuple[float, float, float]]) -> Path:
    """Save the policy curve as a reproducible CSV output."""
    output_dir = Path("output/tables")
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / "subsidy_counterfactual_python.csv"
    with output_path.open("w", newline="", encoding="utf-8") as output_file:
        writer = csv.writer(output_file)
        writer.writerow(["subsidy", "adoption_rate", "fiscal_cost"])
        writer.writerows(rows)
    return output_path


def main() -> None:
    farmers = simulate_data()
    theta, standard_errors, iterations = estimate_logit(farmers)
    names = ["constant", "net_price", "log_land", "distance", "quality"]

    print("Maximum-likelihood estimates (synthetic teaching data)")
    for name, estimate, std_error, truth in zip(
        names, theta, standard_errors, TRUE_THETA, strict=True
    ):
        print(
            f"{name:>10}: estimate={estimate: .3f}, "
            f"SE={std_error:.3f}, truth={truth: .3f}"
        )
    final_log_likelihood = log_likelihood(theta, farmers)
    print(
        f"Converged in {iterations} iterations; "
        f"log likelihood={final_log_likelihood:.3f}"
    )

    price_quartile_fit(theta, farmers)
    rows = subsidy_counterfactual(theta, farmers)
    output_path = save_counterfactual(rows)
    for index in (0, 20, 50):
        subsidy, adoption, cost = rows[index]
        print(
            f"Subsidy={subsidy:.0%}: adoption={adoption:.3f}, "
            f"fiscal cost/farmer={cost:.3f}"
        )
    print(f"Saved counterfactual table to {output_path}")


if __name__ == "__main__":
    main()
