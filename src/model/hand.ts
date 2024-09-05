import { Shuffler, standardShuffler } from "../utils/random_utils";
import * as deck from "../../src/model/deck";

export class Hand {
  private players: string[];
  private playerHands: deck.Card[][];
  public dealer: number;
  private shuffler?: Shuffler<deck.Card>;
  private cardsPerPlayer?: number;
  private _drawPile: deck.Deck;
  private _discardPile: deck.Deck;
  private _playerInTurn: number;
  private isReverse: boolean;

  constructor(
    players: string[],
    dealer: number,
    shuffler?: Shuffler<deck.Card>,
    cardsPerPlayer?: number
  ) {
    if (players.length < 2) throw new Error("Not enough player");
    if (players.length > 10) throw new Error("To many players");
    this.players = players;
    this.playerHands = Array.from({ length: players.length }, () => []);

    this.dealer = dealer;
    this.cardsPerPlayer = cardsPerPlayer;

    this._drawPile = deck.createInitialDeck();
    this._discardPile = new deck.Deck([]);

    this.shuffler = shuffler;
    this.shuffle();

    this._playerInTurn = dealer;
    this.isReverse = false;

    this.initialDealCards();
    this.nextPlayer();
  }

  player(index: number) {
    if (index < 0) throw new Error("Player index out of bounds");
    if (index >= this.players.length)
      throw new Error("Player index out of bounds");
    return this.players[index];
  }

  playerHand(index: number): deck.Card[] {
    return this.playerHands[index];
  }

  discardPile(): deck.Deck {
    return this._discardPile;
  }

  drawPile(): deck.Deck {
    return this._drawPile;
  }

  playerInTurn(): number {
    return this._playerInTurn;
  }

  get playerCount(): number {
    return this.players.length;
  }

  private initialDealCards() {
    this.playerHands.map((playerHand) => {
      for (let index = 0; index < 7; index++) {
        const card = this._drawPile.deal();
        if (card) playerHand.push(card);
      }

      return playerHand;
    });

    let card = this._drawPile.deal();
    if (!card) return;
    this._discardPile.push(card);

    if (card.type === "REVERSE") this.isReverse = true;

    if (card.type === "SKIP") this.nextPlayer();

    if (card.type === "WILD DRAW") this.shuffle();

    if (card.type === "DRAW") {
      const nextPlayer = this.playerHands[
        (this._playerInTurn + 1 + this.players.length) % this.players.length
      ];
      let nextCard = this._drawPile.deal();
      if (nextCard) nextPlayer.push(nextCard);
      nextCard = this._drawPile.deal();
      if (nextCard) nextPlayer.push(nextCard);
    }

    while (this.discardPile().top().type === "WILD") {
      this.shuffle();
      card = this._drawPile.deal();
      if (!card) return;
      this._discardPile.push(card);
    }
  }

  private nextPlayer() {
    const range = this.players.length;

    if (this.isReverse)
      this._playerInTurn = (this._playerInTurn - 1 + range) % range;
    else this._playerInTurn = (this._playerInTurn + 1 + range) % range;
  }

  private shuffle() {
    if (this.shuffler) this._drawPile.shuffle(this.shuffler);
    else this._drawPile.shuffle(standardShuffler);
  }
}

export function createHand(
  players: string[],
  dealer: number,
  shuffler?: Shuffler<deck.Card>,
  cardsPerPlayer?: number
): Hand {
  const hand = new Hand(players, dealer, shuffler, cardsPerPlayer);
  return hand;
}
