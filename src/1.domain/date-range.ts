/**
 * Value object for date ranges in commit analysis
 */
export class DateRange {
  private constructor(
    private readonly startDate: Date,
    private readonly endDate: Date,
  ) {}

  static create(startDate: Date, endDate: Date): DateRange {
    if (!startDate || !endDate) {
      throw new Error('Start date and end date are required')
    }

    if (startDate > endDate) {
      throw new Error('Start date cannot be after end date')
    }

    return new DateRange(new Date(startDate), new Date(endDate))
  }

  static fromYear(year: number): DateRange {
    if (!Number.isInteger(year) || year < 1970) {
      throw new Error('Invalid year provided')
    }

    const startDate = new Date(year, 0, 1) // January 1st
    const endDate = new Date(year, 11, 31, 23, 59, 59, 999) // December 31st

    return new DateRange(startDate, endDate)
  }

  static fromYearRange(startYear: number, endYear: number): DateRange {
    if (startYear > endYear) {
      throw new Error('Start year cannot be after end year')
    }

    const startDate = new Date(startYear, 0, 1)
    const endDate = new Date(endYear, 11, 31, 23, 59, 59, 999)

    return new DateRange(startDate, endDate)
  }

  getStartDate(): Date {
    return new Date(this.startDate)
  }

  getEndDate(): Date {
    return new Date(this.endDate)
  }

  contains(date: Date): boolean {
    return date >= this.startDate && date <= this.endDate
  }

  getYearSpan(): number {
    return this.endDate.getFullYear() - this.startDate.getFullYear() + 1
  }

  getYears(): number[] {
    const years: number[] = []
    for (let year = this.startDate.getFullYear(); year <= this.endDate.getFullYear(); year++) {
      years.push(year)
    }
    return years
  }

  equals(other: DateRange): boolean {
    return this.startDate.getTime() === other.startDate.getTime() &&
           this.endDate.getTime() === other.endDate.getTime()
  }

  toString(): string {
    return `${this.startDate.getFullYear()}-${this.endDate.getFullYear()}`
  }
}