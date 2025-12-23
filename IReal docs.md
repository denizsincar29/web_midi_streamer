# Custom URL Scheme Format

After the `irealbook://` URL scheme identifier, we have six components separated by the `=` character (for this reason the `=` cannot be used in the staff text within the chord progression):

1. **Song Title** - If starting with 'The' change the title to 'Song Title, The' for sorting purposes
2. **Composer's LastName FirstName** - We put the last name first for sorting purposes within the app
3. **Style** - A short text description of the style used for sorting in the app. Medium Swing, Ballad, Pop, Rock...
4. **Key Signature** - C, Db, D, Eb, E, F, Gb, G, Ab, A, Bb, B, A-, Bb-, B-, C-, C#-, D-, Eb-, E-, F-, F#-, G-, G#-
5. **n** - No longer used
6. **Chord Progression** - This is the main part of this url and will be explained in detail below

## Chord Progression Format

The chord progression is a string of symbols describing the song visually the way it should look in iReal Pro.

Create a text string using the symbols listed below keeping in mind that we have 16 cells per line with a maximum of 12 lines. Usually 4 cells per measure which comes to 4 measures per system.

Chords and spaces occupy one cell each while other symbols like bar lines, time signatures, rehearsal symbols... don't count towards the number of available cells.

### Bar Lines

| Symbol | Description |
|--------|-------------|
| `\|` | single bar line |
| `[` | opening double bar line |
| `]` | closing double bar line |
| `{` | opening repeat bar line |
| `}` | closing repeat bar line |
| `Z` | Final thick double bar line |

**Example:**
```
{C |A- |D- |G7 }[C |A- |D- |G7 Z
```

![Bar Lines Example](Screen-Shot-2018-06-07-at-4.39.38-PM.png)
Time signatures:
to be placed before a bar line
T44 4/4
T34 3/4
T24 2/4
T54 5/4
T64 6/4
T74 7/4
T22 2/2
T32 3/2
T58 5/8
T68 6/8
T78 7/8
T98 9/8
T12 12/8
Example: T44[C |A- T98|D- |G7 Z
Screen-Shot-2018-06-07-at-4.43.11-PM-1024x143.png
Rehearsal Marks
*A A section
*B B section
*C C Section
*D D Section
*V Verse
*i Intro
S Segno
Q Coda
f Fermata
Example: *A[C |A- |SD- |G7 QZ
Screen-Shot-2018-06-07-at-4.48.32-PM-1024x189.png
### Endings

| Symbol | Description |
|--------|-------------|
| `N1` | First ending |
| `N2` | Second Ending |
| `N3` | Third Ending |
| `N0` | No text Ending |

**Example:**
```
T44{C |A- |N1D- |G7 } |N2D- G7 |C6 Z
```

![Endings Example](Screen-Shot-2018-06-07-at-4.51.38-PM-1024x348.png)
### Staff Text

Staff text appears under the current chords and needs to be enclosed in angle brackets:
```
<Some staff text>
```

You can move the text upwards relative to the current chord by adding a `*` followed by two digit number between 00 (below the system) and 74 (above the system):
```
<*36Some raised staff text>
```

There are a number of specific staff text phrases that are recognized by the player in iReal Pro:
- `<D.C. al Coda>`
- `<D.C. al Fine>`
- `<D.C. al 1st End.>`
- `<D.C. al 2nd End.>`
- `<D.C. al 3rd End.>`
- `<D.S. al Coda>`
- `<D.S. al Fine>`
- `<D.S. al 1st End.>`
- `<D.S. al 2nd End.>`
- `<D.S. al 3rd End.>`
- `<Fine>`

If you have a section of the song that is enclosed in repeat bar lines `{ }` you can add in the staff text a number followed by 'x' to indicate that the section should repeat that number of times instead of the default 2 times:
```
<8x>
```

**Example:**
```
[T44<*74Solo Section:>C |A- |D- |G7 Z
```
### Vertical Space

You can add a small amount of vertical space between staves by adding between 1 and 3 'Y' at the beginning of a system:
- `Y`
- `YY`
- `YYY`

**Example:**
```
[*AT44C |A- |D- |G7 |E- |A- |D- |G7 ZY[*BC |A- |D- |G7 Z
```
Chords
Chord symbol format: Root + an optional chord quality + an optional inversion
For example just a root:
C
or a root plus a chord quality
C-7
or a root plus in inversion inversion
C/E
or a root plus a quality plus an inversion
C-7/Bb
All valid roots and inversions:
C, C#, Db, D, D#, Eb, E, F, F#, Gb, G, G#, Ab, A, A#, Bb, B
All valid qualities:
5, 2, add9, +, o, h, sus, ^, -, ^7, -7, 7, 7sus, h7, o7, ^9, ^13, 6, 69, ^7#11, ^9#11, ^7#5, -6, -69, -^7, -^9, -9, -11, -7b5, h9, -b6, -#5, 9, 7b9, 7#9, 7#11, 7b5, 7#5, 9#11, 9b5, 9#5, 7b13, 7#9#5, 7#9b5, 7#9#11, 7b9#11, 7b9b5, 7b9#5, 7b9#9, 7b9b13, 7alt, 13, 13#11, 13b9, 13#9, 7b9sus, 7susadd3, 9sus, 13sus, 7b13sus, 11,min13,min^11 , min^13 , maj13#11 , maj7b5 , maj7#9 , min7b6 , min9b6 , maj(add4) , min(add4) , 7(add13)
Alternate Chords:
iReal Pro can also display smaller "alternate" chords above the regular chords. All the same rules apply for the format of the chord and to mark them as alternate chords you enclose them in round parenthesis:
```
(Db^7/F)
```

#### No Chord

`n` - Adds a N.C. symbol in the chart which makes the player skip harmony and bass for that measure or beats

#### Repeat Symbols

- `x` - This is the "Repeat one measure" % symbol and is usually inserted in the middle of an empty measure
- `r` - This is the "Repeat the previous two measures" symbol and is usually inserted across two empty measures

**Example:**
```
[T44C | x | x | x |D-7 |G7 | r| Z
```
#### Slash

Sometimes we might want to add slash symbol to indicate that we want to repeat the preceding chord:
```
|C7ppF7|
```

#### Chord Size

When trying to squeeze many chords in one measure you might want to make them narrower.

To do this insert an `s` in the chord progression and all the following chord symbols will be narrower until a `l` symbol is encountered that restores the normal size.

#### Dividers

One or more space characters are usually used to separate chords but sometimes we want to pack many chords in one measure in which case we use the comma `,` to separate the chords without adding empty cells to the chord progression.

### Complete Song Example

**Chord progression:**
```
{*AT44D- D-/C |Bh7, Bb7(A7b9) |D-/A G-7 |D-/F sEh,A7,|Y|lD- D-/C |Bh7, Bb7(A7b9) |D-/A G-7 |N1D-/F sEh,A7} Y|N2sD-,G-,lD- ][*BC-7 F7 |Bb^7 |C-7 F7 |Bb^7 n ||C-7 F7 |Bb^7 |B-7 E7 |A7,p,p,p,][*AD- D-/C |Bh7, Bb7(A7b9) |D-/A G-7 |D-/F sEh,A7,||lD- D-/C |Bh7, Bb7(A7b9) |D-/A G-7 |D-/F sEh,A7Z
```

**The same song's full custom URL:**
```
irealbook://A Walkin Thing=Carter Benny=Medium Swing=D-=n={*AT44D- D-/C |Bh7, Bb7(A7b9) |D-/A G-7 |D-/F sEh,A7,|Y|lD- D-/C |Bh7, Bb7(A7b9) |D-/A G-7 |N1D-/F sEh,A7}            Y|N2sD-,G-,lD- ][*BC-7 F7 |Bb^7 |C-7 F7 |Bb^7 n ||C-7 F7 |Bb^7 |B-7 E7 |A7,p,p,p,][*AD- D-/C |Bh7, Bb7(A7b9) |D-/A G-7 |D-/F sEh,A7,||lD- D-/C |Bh7, Bb7(A7b9) |D-/A G-7 |D-/F sEh,A7Z
```

> **Note:** Make sure to percent-encode it for safe use with browsers.