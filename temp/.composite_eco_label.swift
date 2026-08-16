import AppKit

let baseURL = URL(fileURLWithPath: "/Users/liuyicen/Desktop/inteplast_home_page_tw/temp/sustainability-hero-designed-eco-label-v5.png")
let markURL = URL(fileURLWithPath: "/Users/liuyicen/Desktop/inteplast_home_page_tw/src/environmental-label-mark-official.png")
let outputURL = URL(fileURLWithPath: "/Users/liuyicen/Desktop/inteplast_home_page_tw/temp/sustainability-hero-official-label-cropped-v10.png")

guard let base = NSImage(contentsOf: baseURL), let mark = NSImage(contentsOf: markURL) else { fatalError("Unable to load input image") }

let canvas = NSSize(width: 1902, height: 827)
let result = NSImage(size: canvas)
result.lockFocus()
base.draw(in: NSRect(origin: .zero, size: canvas))

let center = NSPoint(x: 1208, y: 827 - 394)
NSColor.white.setFill()
NSBezierPath(ovalIn: NSRect(x: center.x - 100, y: center.y - 100, width: 200, height: 200)).fill()

NSGraphicsContext.current?.imageInterpolation = .high
let markHeight: CGFloat = 220
let markWidth = markHeight * 258 / 421
let markRect = NSRect(x: center.x - markWidth / 2, y: 284, width: markWidth, height: markHeight)
NSGraphicsContext.saveGraphicsState()
NSBezierPath(ovalIn: NSRect(x: center.x - 96, y: center.y - 96, width: 192, height: 192)).addClip()
mark.draw(in: markRect, from: .zero, operation: .sourceOver, fraction: 1)
NSGraphicsContext.restoreGraphicsState()

// Remove the detached green remnant from the previous mark, outside the official source crop.
NSColor.white.setFill()
NSBezierPath(ovalIn: NSRect(x: 1209, y: 520, width: 34, height: 20)).fill()
result.unlockFocus()

guard let data = result.tiffRepresentation,
      let rep = NSBitmapImageRep(data: data),
      let png = rep.representation(using: .png, properties: [:]) else { fatalError("Unable to encode output") }
try png.write(to: outputURL)
